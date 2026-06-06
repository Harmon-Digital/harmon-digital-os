-- Audit sweep follow-up:
--
-- 1) project_phases.team_write_phases excluded the 'member' role even though
--    20260602 added 'member' to is_staff(). Members could read phases but
--    could not create / update / delete them, which made phase-driven
--    invoicing silently fail for them. Re-issue the policy with is_staff()
--    for consistency with the rest of the staff-write surface.
--
-- 2) public.should_send_notification_email is SECURITY DEFINER but lacks
--    `SET search_path = ''`. The 20260602 sweep tried to patch this in
--    bulk with `ALTER FUNCTION fn() ...` — that only matches the no-arg
--    overload, so this 4-arg function was silently skipped. A caller who
--    can influence search_path could redirect unqualified operator / type
--    lookups inside the function body. Patch it explicitly here.
--
--    notify_email_on_notification() invokes this function; nothing else in
--    the codebase calls it directly. REVOKE EXECUTE from anon/authenticated
--    so only the trigger (running as the trigger function's owner) can call it.

-- 1. project_phases write policy → is_staff()

DROP POLICY IF EXISTS "team_write_phases" ON public.project_phases;
CREATE POLICY "team_write_phases" ON public.project_phases
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_phases.project_id)
  )
  WITH CHECK (
    public.is_staff()
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_phases.project_id)
  );

-- 2. should_send_notification_email — search_path + revoke direct callers.

ALTER FUNCTION public.should_send_notification_email(uuid, text, text, boolean)
  SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.should_send_notification_email(uuid, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
