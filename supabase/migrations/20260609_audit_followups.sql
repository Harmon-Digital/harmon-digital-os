-- 20260609_audit_followups.sql
--
-- Round-up of items missed by earlier audit sweeps (20260601-20260606):
--
--   1) chat_messages UPDATE/DELETE still only check `auth.uid() = user_id`.
--      A user demoted from staff to a non-staff role can still mutate the
--      messages they posted in staff channels they can no longer see. The
--      SELECT/INSERT policies were re-scoped in 20260602; UPDATE/DELETE
--      were left behind.
--
--   2) task_comments / task_attachments — same pattern: SELECT/INSERT were
--      staff-gated in 20260602 but UPDATE (for comments) and DELETE remain
--      author-only / admin-only.
--
--   3) chat_message_reactions_delete_own ignores the visibility check that
--      the SELECT/INSERT policies enforce — a user can delete their own
--      reaction on a DM they're no longer a participant in.
--
--   4) 20260602 hardened SECURITY DEFINER functions with a `DO $$` block
--      that formatted `ALTER FUNCTION %s() SET search_path = ''`. The
--      empty-argument signature `()` does not match the multi-arg
--      definitions of _notify_if_missing(9 args), _next_task_due_date(3),
--      _create_next_recurring_task_from_source(1), should_send_notification_email(4) —
--      the EXCEPTION handler swallowed every one, leaving them without
--      `SET search_path`. The 20260606 follow-up patched only one.
--      Apply the missing ALTERs explicitly with real signatures.
--
--   5) huddle_join / huddle_leave were rewritten to `LANGUAGE sql VOLATILE`
--      (no SECURITY DEFINER). If huddles has any restrictive UPDATE
--      policy, the RPC silently no-ops for callers who don't satisfy it,
--      bringing back the stuck-open-huddle bug 20260526 fixed. Restore
--      SECURITY DEFINER and explicit grants.

-- =====================================================================
-- 1. chat_messages — staff + author for UPDATE; staff or admin for DELETE
-- =====================================================================

DROP POLICY IF EXISTS "chat_messages_update_own" ON public.chat_messages;
CREATE POLICY "chat_messages_update_own_staff"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND public.is_staff()
    AND EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = chat_messages.channel_id
        AND (
          (c.is_dm = false AND public.is_staff())
          OR (c.is_dm = true AND auth.uid() = ANY(c.dm_user_ids))
        )
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_staff()
  );

DROP POLICY IF EXISTS "chat_messages_delete_own_or_admin" ON public.chat_messages;
CREATE POLICY "chat_messages_delete_own_or_admin_staff"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (
    -- Author may delete only while they remain staff with channel access.
    (
      auth.uid() = user_id
      AND public.is_staff()
      AND EXISTS (
        SELECT 1 FROM public.chat_channels c
        WHERE c.id = chat_messages.channel_id
          AND (
            (c.is_dm = false AND public.is_staff())
            OR (c.is_dm = true AND auth.uid() = ANY(c.dm_user_ids))
          )
      )
    )
    -- Admin override remains for moderation.
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- =====================================================================
-- 2. task_comments — staff-gate UPDATE and DELETE
-- =====================================================================

DROP POLICY IF EXISTS "task_comments_update_own" ON public.task_comments;
CREATE POLICY "task_comments_update_own_staff"
  ON public.task_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_staff())
  WITH CHECK (auth.uid() = user_id AND public.is_staff());

DROP POLICY IF EXISTS "task_comments_delete_own_or_admin" ON public.task_comments;
CREATE POLICY "task_comments_delete_own_or_admin_staff"
  ON public.task_comments FOR DELETE TO authenticated
  USING (
    (auth.uid() = user_id AND public.is_staff())
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- =====================================================================
-- 3. task_attachments — staff-gate DELETE (INSERT/SELECT already are)
-- =====================================================================

DROP POLICY IF EXISTS "task_attachments_delete_uploader_or_admin" ON public.task_attachments;
CREATE POLICY "task_attachments_delete_uploader_or_admin_staff"
  ON public.task_attachments FOR DELETE TO authenticated
  USING (
    (auth.uid() = uploaded_by AND public.is_staff())
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- =====================================================================
-- 4. chat_message_reactions — DELETE must also check channel visibility
-- =====================================================================

DROP POLICY IF EXISTS "chat_message_reactions_delete_own" ON public.chat_message_reactions;
CREATE POLICY "chat_message_reactions_delete_own_visible"
  ON public.chat_message_reactions FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_channels c ON c.id = m.channel_id
      WHERE m.id = chat_message_reactions.message_id
        AND (
          (c.is_dm = false AND public.is_staff())
          OR (c.is_dm = true AND auth.uid() = ANY(c.dm_user_ids))
        )
    )
  );

-- =====================================================================
-- 5. search_path on multi-arg SECURITY DEFINER functions
--    20260602 attempted these with `()` and silently failed.
-- =====================================================================

DO $$
BEGIN
  -- _notify_if_missing(uuid, text, text, text, text, text, text, text, text)
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_notify_if_missing';
  IF FOUND THEN
    EXECUTE 'ALTER FUNCTION public._notify_if_missing(uuid, text, text, text, text, text, text, text, text) SET search_path = ''''';
  END IF;

  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_next_task_due_date';
  IF FOUND THEN
    EXECUTE 'ALTER FUNCTION public._next_task_due_date(date, text, integer) SET search_path = ''''';
  END IF;

  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_create_next_recurring_task_from_source';
  IF FOUND THEN
    -- Single-arg overload uses the public.tasks row type.
    EXECUTE 'ALTER FUNCTION public._create_next_recurring_task_from_source(public.tasks) SET search_path = ''''';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Tolerate signature drift in older databases — surface via NOTICE.
  RAISE NOTICE 'audit_followups: could not set search_path on a definer function (%)', SQLERRM;
END $$;

-- REVOKE EXECUTE with the real signatures (the 20260602 list used wrong ones,
-- so the REVOKEs no-op'd). Keep idempotent.
DO $$
BEGIN
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_notify_if_missing';
  IF FOUND THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public._notify_if_missing(uuid, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated';
  END IF;

  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_next_task_due_date';
  IF FOUND THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public._next_task_due_date(date, text, integer) FROM PUBLIC, anon, authenticated';
  END IF;

  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_create_next_recurring_task_from_source';
  IF FOUND THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public._create_next_recurring_task_from_source(public.tasks) FROM PUBLIC, anon, authenticated';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'audit_followups: could not revoke execute (%)', SQLERRM;
END $$;

-- =====================================================================
-- 6. huddle_join / huddle_leave — restore SECURITY DEFINER so an RLS
--    UPDATE policy on huddles can't silently strand callers.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.huddle_leave(huddle_id uuid)
RETURNS int
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.huddles
    SET participant_count = greatest(participant_count - 1, 0),
        ended_at = CASE
          WHEN greatest(participant_count - 1, 0) = 0 THEN now()
          ELSE ended_at
        END
  WHERE id = huddle_id AND ended_at IS NULL
  RETURNING participant_count;
$$;

CREATE OR REPLACE FUNCTION public.huddle_join(huddle_id uuid)
RETURNS int
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.huddles
    SET participant_count = participant_count + 1
  WHERE id = huddle_id AND ended_at IS NULL
  RETURNING participant_count;
$$;

REVOKE EXECUTE ON FUNCTION public.huddle_join(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.huddle_leave(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.huddle_join(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.huddle_leave(uuid) TO authenticated;
