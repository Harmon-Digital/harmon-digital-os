-- =======================================================================
-- 20260603_rls_close_legacy_holes.sql
--
-- The 20260602 sweep added scoped client/partner SELECT policies on the
-- core business tables, but never DROPPED the legacy "Authenticated can ..."
-- permissive policies (qual: auth.uid() IS NOT NULL). Postgres OR's PERMISSIVE
-- policies, so the legacy ones still grant every authenticated user — including
-- clients and partners — full SELECT/INSERT/UPDATE/DELETE on every core table.
-- This migration closes that hole table-by-table:
--
--   1) Add a `staff_all_<table>` policy gated by public.is_staff() so the
--      staff app keeps working.
--   2) DROP the legacy "Authenticated can ..." / "Authenticated users can ..."
--      permissive policies.
--   3) Also tighten kpi_entries and project_documents SELECT policies that
--      had qual: true (visible to anon/everyone).
--   4) Lock team_members.role and other privileged columns against self-update
--      with a BEFORE UPDATE guard trigger.
--   5) Change the default role for self-signups from 'member' to 'user' so a
--      new signup is NOT in is_staff() (which still accepts 'member' for the
--      existing legitimate users).
-- =======================================================================

-- -----------------------------------------------------------------------
-- 1. Add staff_all_* policies (USING + WITH CHECK = is_staff())
-- -----------------------------------------------------------------------

-- accounts
CREATE POLICY "staff_all_accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- activities
CREATE POLICY "staff_all_activities" ON public.activities
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- branding_settings (admin-only at write time, staff-visible at read)
CREATE POLICY "staff_select_branding_settings" ON public.branding_settings
  FOR SELECT TO authenticated
  USING (public.is_staff());
-- ("Admins can manage branding" already covers admin INSERT/UPDATE/DELETE)

-- contacts
CREATE POLICY "staff_all_contacts" ON public.contacts
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- expenses
CREATE POLICY "staff_all_expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- invoices
CREATE POLICY "staff_all_invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- lead_activities
CREATE POLICY "staff_all_lead_activities" ON public.lead_activities
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- leads
CREATE POLICY "staff_all_leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- notifications: staff can read/write all, individual users can see their own
CREATE POLICY "staff_all_notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- payments
CREATE POLICY "staff_all_payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- projects
CREATE POLICY "staff_all_projects" ON public.projects
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- project_documents: staff full access; clients_read_own_documents stays.
CREATE POLICY "staff_all_project_documents" ON public.project_documents
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- social_posts: staff full access; client approval policy remains.
CREATE POLICY "staff_all_social_posts" ON public.social_posts
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- sops (admin already has manage; staff need read)
CREATE POLICY "staff_select_sops" ON public.sops
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- stripe_products (admin already has manage; staff need read)
CREATE POLICY "staff_select_stripe_products" ON public.stripe_products
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- stripe_subscriptions (admin already has manage; staff need read)
CREATE POLICY "staff_select_stripe_subscriptions" ON public.stripe_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- tasks
CREATE POLICY "staff_all_tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- time_entries
CREATE POLICY "staff_all_time_entries" ON public.time_entries
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- transactions
CREATE POLICY "staff_all_transactions" ON public.transactions
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- team_members: staff need read-only access for assignment dropdowns etc.
-- Self-update is allowed via a separate policy guarded by a trigger below.
CREATE POLICY "staff_select_team_members" ON public.team_members
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- kpi_entries: was previously qual:true SELECT (open to everyone).
CREATE POLICY "staff_all_kpi_entries" ON public.kpi_entries
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- -----------------------------------------------------------------------
-- 2. Drop legacy permissive "Authenticated ..." policies and qual:true ones
-- -----------------------------------------------------------------------

-- accounts
DROP POLICY IF EXISTS "Authenticated users can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can delete accounts" ON public.accounts;

-- activities
DROP POLICY IF EXISTS "Authenticated can view activities" ON public.activities;
DROP POLICY IF EXISTS "Authenticated can insert activities" ON public.activities;
DROP POLICY IF EXISTS "Authenticated can update activities" ON public.activities;
DROP POLICY IF EXISTS "Authenticated can delete activities" ON public.activities;
DROP POLICY IF EXISTS "Authenticated users can create activities" ON public.activities;

-- branding_settings
DROP POLICY IF EXISTS "Authenticated can view branding_settings" ON public.branding_settings;
DROP POLICY IF EXISTS "Authenticated can insert branding_settings" ON public.branding_settings;
DROP POLICY IF EXISTS "Authenticated can update branding_settings" ON public.branding_settings;
DROP POLICY IF EXISTS "Authenticated can delete branding_settings" ON public.branding_settings;
DROP POLICY IF EXISTS "Authenticated users can view branding" ON public.branding_settings;

-- contacts
DROP POLICY IF EXISTS "Authenticated can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated can delete contacts" ON public.contacts;

-- expenses
DROP POLICY IF EXISTS "Authenticated can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated can delete expenses" ON public.expenses;

-- invoices
DROP POLICY IF EXISTS "Authenticated can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated can delete invoices" ON public.invoices;

-- lead_activities
DROP POLICY IF EXISTS "Authenticated users can view activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Authenticated users can create activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Users can update own activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Admins can delete activities" ON public.lead_activities;

-- leads
DROP POLICY IF EXISTS "Authenticated can view leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated can update leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can create leads" ON public.leads;

-- notifications
DROP POLICY IF EXISTS "Authenticated can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can delete notifications" ON public.notifications;
-- "Users can view own notifications" and "Users can update own notifications"
-- stay so client/partner users can still see their personal notifications.

-- payments
DROP POLICY IF EXISTS "Authenticated can view payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated can update payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated can delete payments" ON public.payments;

-- project_documents
DROP POLICY IF EXISTS "Users can view project documents" ON public.project_documents;
DROP POLICY IF EXISTS "Users can insert project documents" ON public.project_documents;
DROP POLICY IF EXISTS "Users can delete their uploaded documents" ON public.project_documents;
-- clients_read_own_documents stays.

-- projects
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON public.projects;

-- social_posts
DROP POLICY IF EXISTS "Authenticated can view social_posts" ON public.social_posts;
DROP POLICY IF EXISTS "Authenticated can insert social_posts" ON public.social_posts;
DROP POLICY IF EXISTS "Authenticated can update social_posts" ON public.social_posts;
DROP POLICY IF EXISTS "Authenticated can delete social_posts" ON public.social_posts;
DROP POLICY IF EXISTS "Authenticated users can create social posts" ON public.social_posts;
DROP POLICY IF EXISTS "Authenticated users can view social posts" ON public.social_posts;

-- sops
DROP POLICY IF EXISTS "Authenticated can view sops" ON public.sops;
DROP POLICY IF EXISTS "Authenticated can insert sops" ON public.sops;
DROP POLICY IF EXISTS "Authenticated can update sops" ON public.sops;
DROP POLICY IF EXISTS "Authenticated can delete sops" ON public.sops;
DROP POLICY IF EXISTS "Authenticated users can view published SOPs" ON public.sops;

-- stripe_products
DROP POLICY IF EXISTS "Authenticated can view stripe_products" ON public.stripe_products;
DROP POLICY IF EXISTS "Authenticated can insert stripe_products" ON public.stripe_products;
DROP POLICY IF EXISTS "Authenticated can update stripe_products" ON public.stripe_products;
DROP POLICY IF EXISTS "Authenticated can delete stripe_products" ON public.stripe_products;
DROP POLICY IF EXISTS "Authenticated users can view stripe products" ON public.stripe_products;

-- stripe_subscriptions
DROP POLICY IF EXISTS "Authenticated can view stripe_subscriptions" ON public.stripe_subscriptions;
DROP POLICY IF EXISTS "Authenticated can insert stripe_subscriptions" ON public.stripe_subscriptions;
DROP POLICY IF EXISTS "Authenticated can update stripe_subscriptions" ON public.stripe_subscriptions;
DROP POLICY IF EXISTS "Authenticated can delete stripe_subscriptions" ON public.stripe_subscriptions;
DROP POLICY IF EXISTS "Authenticated users can view stripe subscriptions" ON public.stripe_subscriptions;

-- tasks
DROP POLICY IF EXISTS "Authenticated can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can create tasks" ON public.tasks;

-- team_members
DROP POLICY IF EXISTS "Authenticated can view team_members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated users can view team members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated can update team_members" ON public.team_members;
DROP POLICY IF EXISTS "Users can update own team member record" ON public.team_members;

-- time_entries
DROP POLICY IF EXISTS "Authenticated can view time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Authenticated can insert time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Authenticated can update time_entries" ON public.time_entries;

-- transactions
DROP POLICY IF EXISTS "Authenticated can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated can delete transactions" ON public.transactions;

-- kpi_entries
DROP POLICY IF EXISTS "Authenticated users can read KPI entries" ON public.kpi_entries;

-- -----------------------------------------------------------------------
-- 3. Lock team_members.role and other privileged columns against self-update
-- -----------------------------------------------------------------------

-- Allow a user to update their own (non-privileged) team_members fields.
CREATE POLICY "team_members_self_update" ON public.team_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- BEFORE UPDATE trigger: pin privileged columns to OLD values for non-admins.
-- Without this, the SELF-update policy lets a user UPDATE team_members SET role='admin'
-- WHERE user_id = auth.uid(). The role on team_members is read by other RLS
-- policies (toggl_settings/toggl_sync_runs admin gates), so a self-elevation
-- unlocks privileged surfaces.
CREATE OR REPLACE FUNCTION public.guard_team_members_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role text := current_setting('role', true);
BEGIN
  IF caller_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;
  -- Non-admin: pin every privileged column to its prior value.
  NEW.role := OLD.role;
  NEW.hourly_rate := OLD.hourly_rate;
  NEW.employment_type := OLD.employment_type;
  NEW.user_id := OLD.user_id;
  NEW.email := OLD.email;
  NEW.status := OLD.status;
  -- Outreach goals/bonus rates are admin-set; pin them too if present.
  BEGIN
    NEW.outreach_daily_goal := OLD.outreach_daily_goal;
    NEW.outreach_weekly_goal := OLD.outreach_weekly_goal;
    NEW.outreach_bonus_amount := OLD.outreach_bonus_amount;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_team_members_update ON public.team_members;
CREATE TRIGGER trg_guard_team_members_update
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_team_members_update();

-- These trigger helpers are not meant to be callable as REST RPCs. Revoke
-- from both anon and authenticated (PUBLIC alone isn't enough — Supabase
-- often grants directly to those roles at function creation time).
REVOKE EXECUTE ON FUNCTION public.guard_team_members_update() FROM anon, authenticated, PUBLIC;

-- -----------------------------------------------------------------------
-- 4. Default new signups to role='user' (NOT in is_staff()) so a public
--    signup can't immediately read every staff table.
--    Existing 'member' users continue to pass is_staff() — no impact.
-- -----------------------------------------------------------------------

-- Also revoke from the role guard (trigger-only, not a public RPC).
-- guard_user_profiles_role itself is created via CREATE OR REPLACE below so
-- we re-revoke after redefinition.

CREATE OR REPLACE FUNCTION public.guard_user_profiles_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  caller_role text := current_setting('role', true);
  is_service  boolean := caller_role = 'service_role';
  caller_is_admin boolean := FALSE;
BEGIN
  IF is_service THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO caller_is_admin;

  IF caller_is_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Was 'member' — but 'member' is treated as staff by is_staff(), so a
    -- public auth.signUp() would have granted staff-level RLS. 'user' is
    -- explicitly outside is_staff().
    NEW.role := 'user';
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_user_profiles_role() FROM anon, authenticated, PUBLIC;
