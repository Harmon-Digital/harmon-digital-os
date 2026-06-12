-- 20260612_audit_followups.sql
--
-- Audit sweep follow-ups for items uncovered after 20260609:
--
--   1) huddle_join / huddle_leave were restored to SECURITY DEFINER in
--      20260609 so RLS on `huddles` couldn't strand callers, but the
--      functions now bypass *every* check — including authorization. With
--      `GRANT EXECUTE … TO authenticated`, any signed-in user (clients,
--      portal partners) can call `huddle_join(<any uuid>)` to bump a stranger
--      huddle's participant_count, or `huddle_leave(<any uuid>)` repeatedly
--      to force `ended_at = now()` and kick everyone out. Gate by
--      `is_staff()` — only staff users have huddles.
--
--   2) chat_channels still carries the original 20260415 policies
--      `chat_channels_update_creator_or_admin` and `_delete_creator_or_admin`.
--      Neither checks `is_staff()` and `is_dm`. Consequences:
--        - A demoted non-staff user can still UPDATE / DELETE channels they
--          created while staff.
--        - A DM party can unilaterally DELETE the DM, cascading both sides'
--          message history.
--        - The UPDATE policy has no `WITH CHECK` so the same caller could
--          flip `is_dm` to false (subject only to the dm_shape_check
--          CHECK constraint) and expose the DM to all staff via the
--          public-channel SELECT path.
--      Replace with staff-gated policies and a trigger pinning the shape
--      columns on update.
--
--   3) `_notify_if_missing` dedupes by `n.dedupe_key = p_dedupe_key`. When
--      `p_dedupe_key IS NULL`, `= NULL` evaluates to NULL (not TRUE), the
--      EXISTS is always false, and every cron tick spams a fresh row. The
--      partial unique index `notifications_user_dedupe_unique` skips NULLs,
--      so nothing on the DB side catches the duplicate. Reject NULL keys
--      explicitly so callers can't accidentally flood inboxes.
--
--   4) `guard_user_profiles_role` was hardened in 20260603 with
--      `SET search_path = 'public'`. The 20260606 sweep then standardised
--      every other SECURITY DEFINER on the empty schema (`''`), but this
--      one was missed. Realign so all definer functions share the
--      hardened search_path and don't depend on `public` being safe.
--
--   5) Add the missing index for the new RLS DELETE policies on
--      `chat_message_attachments(uploaded_by)` and
--      `chat_message_reactions(user_id)`. Without these, every DELETE that
--      hits `auth.uid() = uploaded_by` / `auth.uid() = user_id` does a seq
--      scan of the table — fine today, painful as chat volume grows.
--
--   6) `chat_channel_reads` INSERT/UPDATE policies only check
--      `auth.uid() = user_id`. A non-staff user can probe arbitrary
--      `channel_id` UUIDs (a successful upsert means the channel exists; an
--      FK violation tells them it doesn't). Add the same channel-visibility
--      EXISTS check that the SELECT path uses on chat_messages.
--
--   7) `notification_preferences` policies in 20260415 omit `TO authenticated`.
--      They apply to `public` (every role). Safe today because the predicate
--      depends on `auth.uid()` which is NULL for `anon`, but it's a footgun
--      if a future migration ever grants the anon role privileges on this
--      table. Realign with the rest of the schema.

-- =====================================================================
-- 1. huddle_join / huddle_leave — require staff caller
-- =====================================================================

CREATE OR REPLACE FUNCTION public.huddle_join(huddle_id uuid)
RETURNS int
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.huddles
    SET participant_count = participant_count + 1
    WHERE id = huddle_id AND ended_at IS NULL
    RETURNING participant_count INTO v_count;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.huddle_leave(huddle_id uuid)
RETURNS int
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.huddles
    SET participant_count = greatest(participant_count - 1, 0),
        ended_at = CASE
          WHEN greatest(participant_count - 1, 0) = 0 THEN now()
          ELSE ended_at
        END
    WHERE id = huddle_id AND ended_at IS NULL
    RETURNING participant_count INTO v_count;
  RETURN v_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.huddle_join(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.huddle_leave(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.huddle_join(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.huddle_leave(uuid) TO authenticated;

-- =====================================================================
-- 2. chat_channels — staff-gated UPDATE / DELETE; pin shape on update
-- =====================================================================

DROP POLICY IF EXISTS "chat_channels_update_creator_or_admin" ON public.chat_channels;
DROP POLICY IF EXISTS "chat_channels_delete_creator_or_admin" ON public.chat_channels;

CREATE POLICY "chat_channels_update_creator_staff"
  ON public.chat_channels FOR UPDATE TO authenticated
  USING (
    is_dm = false
    AND auth.uid() = created_by
    AND public.is_staff()
  )
  WITH CHECK (
    is_dm = false
    AND auth.uid() = created_by
    AND public.is_staff()
  );

CREATE POLICY "chat_channels_delete_admin_only"
  ON public.chat_channels FOR DELETE TO authenticated
  USING (
    is_dm = false
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- BEFORE UPDATE trigger: keep is_dm, dm_user_ids, and created_by immutable
-- for non-service callers. The new UPDATE policy already filters by
-- `is_dm = false`, but defense in depth — if anyone reintroduces a more
-- permissive policy this trigger still blocks shape mutation.
CREATE OR REPLACE FUNCTION public.guard_chat_channels_shape()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.is_dm IS DISTINCT FROM OLD.is_dm THEN
    RAISE EXCEPTION 'chat_channels.is_dm is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.dm_user_ids IS DISTINCT FROM OLD.dm_user_ids THEN
    RAISE EXCEPTION 'chat_channels.dm_user_ids is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'chat_channels.created_by is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_chat_channels_shape ON public.chat_channels;
CREATE TRIGGER trg_guard_chat_channels_shape
  BEFORE UPDATE ON public.chat_channels
  FOR EACH ROW EXECUTE FUNCTION public.guard_chat_channels_shape();

REVOKE EXECUTE ON FUNCTION public.guard_chat_channels_shape() FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- 3. _notify_if_missing — reject NULL dedupe_key
-- =====================================================================

CREATE OR REPLACE FUNCTION public._notify_if_missing(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_link text,
  p_category text,
  p_priority text,
  p_source text,
  p_dedupe_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- A NULL dedupe_key makes `n.dedupe_key = p_dedupe_key` evaluate to NULL,
  -- the EXISTS is always false, and we spam the user on every cron tick.
  -- The partial unique index on notifications also skips NULL keys, so
  -- nothing on the DB side caught this. Surface as a hard error so a
  -- caller that forgot the key fails loudly instead of flooding inboxes.
  IF p_dedupe_key IS NULL OR length(trim(p_dedupe_key)) = 0 THEN
    RAISE EXCEPTION '_notify_if_missing requires a non-empty dedupe_key';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = p_user_id
      AND n.dedupe_key = p_dedupe_key
      AND n.created_at >= (now() - interval '24 hours')
  ) THEN
    INSERT INTO public.notifications (
      user_id, type, title, message, link, category, priority, source, dedupe_key, read
    )
    VALUES (
      p_user_id, p_type, p_title, p_message, p_link, p_category, p_priority, p_source, p_dedupe_key, false
    );
  END IF;
END;
$$;

-- =====================================================================
-- 4. guard_user_profiles_role — search_path = '' (was 'public')
-- =====================================================================

DO $$
BEGIN
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'guard_user_profiles_role';
  IF FOUND THEN
    EXECUTE 'ALTER FUNCTION public.guard_user_profiles_role() SET search_path = ''''';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '20260612: could not realign guard_user_profiles_role search_path (%)', SQLERRM;
END $$;

-- =====================================================================
-- 5. Indexes for new RLS-policy filter columns
-- =====================================================================

CREATE INDEX IF NOT EXISTS chat_message_attachments_uploaded_by_idx
  ON public.chat_message_attachments(uploaded_by);

CREATE INDEX IF NOT EXISTS chat_message_reactions_user_id_idx
  ON public.chat_message_reactions(user_id);

-- =====================================================================
-- 6. chat_channel_reads — gate INSERT/UPDATE on channel visibility
-- =====================================================================

DROP POLICY IF EXISTS "chat_channel_reads_insert_own" ON public.chat_channel_reads;
CREATE POLICY "chat_channel_reads_insert_own"
  ON public.chat_channel_reads FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = chat_channel_reads.channel_id
        AND (
          (c.is_dm = false AND public.is_staff())
          OR (c.is_dm = true AND auth.uid() = ANY(c.dm_user_ids))
        )
    )
  );

DROP POLICY IF EXISTS "chat_channel_reads_update_own" ON public.chat_channel_reads;
CREATE POLICY "chat_channel_reads_update_own"
  ON public.chat_channel_reads FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = chat_channel_reads.channel_id
        AND (
          (c.is_dm = false AND public.is_staff())
          OR (c.is_dm = true AND auth.uid() = ANY(c.dm_user_ids))
        )
    )
  );

-- =====================================================================
-- 7. notification_preferences — add TO authenticated on all three policies
-- =====================================================================

DO $$
BEGIN
  -- Re-create with explicit role target. Drop/recreate is safe — the
  -- predicate stays identical so behaviour for signed-in users is unchanged.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notification_preferences'
      AND policyname='Users can read own notification preferences'
  ) THEN
    EXECUTE 'DROP POLICY "Users can read own notification preferences" ON public.notification_preferences';
  END IF;
  EXECUTE 'CREATE POLICY "Users can read own notification preferences"
    ON public.notification_preferences FOR SELECT TO authenticated
    USING (auth.uid() = user_id)';

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notification_preferences'
      AND policyname='Users can upsert own notification preferences'
  ) THEN
    EXECUTE 'DROP POLICY "Users can upsert own notification preferences" ON public.notification_preferences';
  END IF;
  EXECUTE 'CREATE POLICY "Users can upsert own notification preferences"
    ON public.notification_preferences FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id)';

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notification_preferences'
      AND policyname='Users can update own notification preferences'
  ) THEN
    EXECUTE 'DROP POLICY "Users can update own notification preferences" ON public.notification_preferences';
  END IF;
  EXECUTE 'CREATE POLICY "Users can update own notification preferences"
    ON public.notification_preferences FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id)';
END $$;
