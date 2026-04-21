-- 1) Allow 'exit' as a billing_type (was silently rejected by the old CHECK)
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_billing_type_check;
ALTER TABLE projects
  ADD CONSTRAINT projects_billing_type_check
  CHECK (billing_type = ANY (ARRAY['hourly'::text, 'fixed'::text, 'retainer'::text, 'internal'::text, 'exit'::text]));

-- 2) Total budget column for fixed-fee projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS total_budget NUMERIC(14, 2);

-- 3) Phases table for milestone-based projects
CREATE TABLE IF NOT EXISTS project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'invoiced', 'paid', 'cancelled')),
  order_index INT NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  invoiced_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_phases_project ON project_phases(project_id, order_index);

ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_read_phases" ON project_phases;
CREATE POLICY "team_read_phases" ON project_phases
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_phases.project_id));

DROP POLICY IF EXISTS "team_write_phases" ON project_phases;
CREATE POLICY "team_write_phases" ON project_phases
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects p
    INNER JOIN user_profiles up ON up.id = auth.uid()
    WHERE p.id = project_phases.project_id
      AND up.role IN ('admin', 'team', 'contractor')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects p
    INNER JOIN user_profiles up ON up.id = auth.uid()
    WHERE p.id = project_phases.project_id
      AND up.role IN ('admin', 'team', 'contractor')
  ));

DROP POLICY IF EXISTS "clients_read_own_phases" ON project_phases;
CREATE POLICY "clients_read_own_phases" ON project_phases
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE client_visible = true
        AND account_id IN (SELECT account_id FROM client_accessible_accounts)
    )
  );

CREATE OR REPLACE FUNCTION update_project_phases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_phases_updated_at ON project_phases;
CREATE TRIGGER trg_project_phases_updated_at
  BEFORE UPDATE ON project_phases
  FOR EACH ROW
  EXECUTE FUNCTION update_project_phases_updated_at();
