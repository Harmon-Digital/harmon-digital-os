-- Allow tasks to be tied to a CRM lead (deal)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON tasks(lead_id) WHERE lead_id IS NOT NULL;
