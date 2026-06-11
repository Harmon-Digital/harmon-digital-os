-- 20260611_audit_followups.sql
--
-- Round-up of items missed by earlier audit sweeps (20260601-20260609):
--
--   1) public.notify_email_on_notification() is SECURITY DEFINER but lacks
--      `SET search_path = ''`. The 20260606 sweep patched the *callee*
--      should_send_notification_email; the *caller* trigger function was
--      missed and is the actual exposed surface (it runs on every INSERT
--      into public.notifications). A connection that can influence
--      search_path could redirect the unqualified `public.should_send_...`
--      lookup to a malicious schema and execute attacker code with the
--      definer's privileges.
--
--   2) chat_message_attachments.file_size is INTEGER while
--      task_attachments.file_size is BIGINT. Files > 2 GB would silently
--      overflow into negative values on the chat side. Standardize to
--      bigint to match task_attachments (and to allow the real range we
--      already enforce at the storage layer).

-- =====================================================================
-- 1. notify_email_on_notification — set search_path on the trigger
--    function. Pinning search_path to empty forces all references
--    inside the body to be schema-qualified (the body already uses
--    `public.should_send_notification_email` and `vault.decrypted_secrets`,
--    so no further changes are required).
-- =====================================================================

DO $$
BEGIN
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'notify_email_on_notification';
  IF FOUND THEN
    EXECUTE 'ALTER FUNCTION public.notify_email_on_notification() SET search_path = ''''';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'audit_followups_0611: could not set search_path on notify_email_on_notification (%)', SQLERRM;
END $$;

-- =====================================================================
-- 2. chat_message_attachments.file_size — widen to bigint to match
--    task_attachments and avoid silent integer overflow on > 2 GB files.
--    Idempotent: the cast from integer → bigint is implicit and safe.
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_message_attachments'
      AND column_name = 'file_size'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE public.chat_message_attachments
      ALTER COLUMN file_size SET DATA TYPE bigint;
  END IF;
END $$;
