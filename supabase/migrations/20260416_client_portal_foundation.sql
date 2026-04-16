-- Client Portal Foundation
-- Adds client role + contact↔auth user linkage + client_visible flags + RLS

-- 1) Allow 'client' as a valid user_profiles.role value
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_role_check'
  ) THEN
    ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
  END IF;
END $$;

-- 2) Link a contact to their auth user for portal access
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS portal_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_portal_user_id_unique
  ON contacts(portal_user_id) WHERE portal_user_id IS NOT NULL;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS portal_invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_last_login_at TIMESTAMPTZ;

-- 3) Flags for what's client-visible
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE project_documents
  ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT false;

-- 4) Helper view: accounts accessible to current client user
CREATE OR REPLACE VIEW client_accessible_accounts AS
SELECT DISTINCT c.account_id
FROM contacts c
WHERE c.portal_user_id = auth.uid();

-- 5) RLS policies for client role
DROP POLICY IF EXISTS "clients_read_own_projects" ON projects;
CREATE POLICY "clients_read_own_projects" ON projects
  FOR SELECT TO authenticated
  USING (
    client_visible = true
    AND account_id IN (SELECT account_id FROM client_accessible_accounts)
  );

DROP POLICY IF EXISTS "clients_read_own_tasks" ON tasks;
CREATE POLICY "clients_read_own_tasks" ON tasks
  FOR SELECT TO authenticated
  USING (
    client_visible = true
    AND project_id IN (
      SELECT id FROM projects
      WHERE account_id IN (SELECT account_id FROM client_accessible_accounts)
    )
  );

DROP POLICY IF EXISTS "clients_read_own_invoices" ON invoices;
CREATE POLICY "clients_read_own_invoices" ON invoices
  FOR SELECT TO authenticated
  USING (
    account_id IN (SELECT account_id FROM client_accessible_accounts)
  );

DROP POLICY IF EXISTS "clients_read_own_documents" ON project_documents;
CREATE POLICY "clients_read_own_documents" ON project_documents
  FOR SELECT TO authenticated
  USING (
    client_visible = true
    AND project_id IN (
      SELECT id FROM projects
      WHERE account_id IN (SELECT account_id FROM client_accessible_accounts)
    )
  );

DROP POLICY IF EXISTS "clients_read_own_account" ON accounts;
CREATE POLICY "clients_read_own_account" ON accounts
  FOR SELECT TO authenticated
  USING (id IN (SELECT account_id FROM client_accessible_accounts));

DROP POLICY IF EXISTS "clients_read_own_contact" ON contacts;
CREATE POLICY "clients_read_own_contact" ON contacts
  FOR SELECT TO authenticated
  USING (portal_user_id = auth.uid());

DROP POLICY IF EXISTS "clients_read_own_social_posts" ON social_posts;
CREATE POLICY "clients_read_own_social_posts" ON social_posts
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT account_id FROM client_accessible_accounts)
  );

DROP POLICY IF EXISTS "clients_approve_own_social_posts" ON social_posts;
CREATE POLICY "clients_approve_own_social_posts" ON social_posts
  FOR UPDATE TO authenticated
  USING (client_id IN (SELECT account_id FROM client_accessible_accounts))
  WITH CHECK (client_id IN (SELECT account_id FROM client_accessible_accounts));

-- 6) client_invitations audit log
CREATE TABLE IF NOT EXISTS client_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_client_invitations_contact ON client_invitations(contact_id);

ALTER TABLE client_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_invites" ON client_invitations
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role IN ('admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role IN ('admin')
  ));
