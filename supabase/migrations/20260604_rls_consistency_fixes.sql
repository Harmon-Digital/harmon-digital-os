-- 20260604_rls_consistency_fixes.sql
--
-- Tighten three RLS surfaces that diverged from the rest of the codebase
-- after the 20260601/20260602/20260603 sweeps:
--
--   1) toggl_settings / toggl_sync_runs read `team_members.role = 'admin'`,
--      but every other admin gate (the toggl-sync edge function, is_admin(),
--      the user_profiles role guard trigger) keys off `user_profiles.role`.
--      An admin per user_profiles without a `team_members{role:'admin'}` row
--      silently can't read or modify toggl settings from the frontend.
--
--   2) clients_approve_own_social_posts is scoped only by client_accessible_
--      accounts — no role check. A non-client user who somehow becomes a
--      contacts.portal_user_id could UPDATE social_posts on that account.
--      Add a belt-and-suspenders role='client' check.
--
--   3) chat_message_attachments INSERT requires only `uploaded_by = auth.uid()`,
--      not that the caller can actually see the parent chat_message. The
--      SELECT/INSERT policies on chat_messages are staff-only via is_staff(),
--      so a portal user technically can't read a message but could insert an
--      attachment row pointing at a guessed UUID. Tighten INSERT to require
--      the parent message is visible (the SELECT subquery is itself subject
--      to chat_messages' RLS, so this enforces channel/dm visibility).
--      Also tighten DELETE: the caller must currently be able to see the
--      parent message, not just have uploaded the attachment.

-- -----------------------------------------------------------------------
-- 1. toggl_settings & toggl_sync_runs — switch to user_profiles.role
-- -----------------------------------------------------------------------

DROP POLICY IF EXISTS "toggl_settings admin all" ON public.toggl_settings;
CREATE POLICY "toggl_settings admin all" ON public.toggl_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "toggl_sync_runs admin read" ON public.toggl_sync_runs;
CREATE POLICY "toggl_sync_runs admin read" ON public.toggl_sync_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------
-- 2. clients_approve_own_social_posts — require role='client'
-- -----------------------------------------------------------------------

DROP POLICY IF EXISTS "clients_approve_own_social_posts" ON public.social_posts;
CREATE POLICY "clients_approve_own_social_posts" ON public.social_posts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'client'
    )
    AND client_id IN (SELECT account_id FROM public.client_accessible_accounts)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'client'
    )
    AND client_id IN (SELECT account_id FROM public.client_accessible_accounts)
  );

-- -----------------------------------------------------------------------
-- 3. chat_message_attachments — require visibility of the parent message
-- -----------------------------------------------------------------------

DROP POLICY IF EXISTS "insert_chat_attachments" ON public.chat_message_attachments;
CREATE POLICY "insert_chat_attachments" ON public.chat_message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.id = chat_message_attachments.message_id
    )
  );

DROP POLICY IF EXISTS "delete_own_chat_attachments" ON public.chat_message_attachments;
CREATE POLICY "delete_own_chat_attachments" ON public.chat_message_attachments
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.id = chat_message_attachments.message_id
    )
  );
