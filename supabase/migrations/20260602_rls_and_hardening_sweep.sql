-- RLS + DEFINER hardening sweep
-- Closes a set of cross-tenant data leaks reachable by client / partner role
-- users, removes a stray catch-all task_attachments policy, restores the
-- user_profiles role CHECK constraint, and tightens SECURITY DEFINER
-- functions (search_path + REVOKE EXECUTE from non-service callers).

-- ============================================================
-- 0. is_staff() helper — excludes 'client' and 'partner'
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'team', 'contractor', 'member')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ============================================================
-- 1. user_profiles role CHECK constraint — restore
-- ============================================================

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin','team','contractor','member','client','partner','user'));

-- ============================================================
-- 2. bot_channels / bot_messages / bot_channel_integrations
--    USING(true) → staff-only. Integrations table may hold secrets.
-- ============================================================

DROP POLICY IF EXISTS "Bot channels readable by authenticated" ON public.bot_channels;
CREATE POLICY "bot_channels_select_staff_only"
  ON public.bot_channels FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Bot messages readable by authenticated" ON public.bot_messages;
CREATE POLICY "bot_messages_select_staff_only"
  ON public.bot_messages FOR SELECT TO authenticated
  USING (public.is_staff());

-- INSERT: real user messages only; assistant/system writes must come from service-role.
DROP POLICY IF EXISTS "Bot messages insert by authenticated" ON public.bot_messages;
CREATE POLICY "bot_messages_insert_self_user_role_only"
  ON public.bot_messages FOR INSERT TO authenticated
  WITH CHECK (
    role = 'user'
    AND auth.uid() = user_id
    AND public.is_staff()
  );

-- Admins only — config jsonb plausibly contains webhook secrets/tokens.
-- Wrap in DO: table is conditionally present (was dropped on some deployments).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='bot_channel_integrations') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Bot integrations readable by authenticated" ON public.bot_channel_integrations';
    EXECUTE $POL$
      CREATE POLICY "bot_integrations_select_admin_only"
        ON public.bot_channel_integrations FOR SELECT TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid() AND up.role = 'admin'
        ))
    $POL$;
  END IF;
END $$;

-- ============================================================
-- 3. chat_channels / chat_messages / chat_message_reactions
--    Non-DM channels become staff-only. DM rules unchanged.
-- ============================================================

DROP POLICY IF EXISTS "chat_channels_select_participants_or_public" ON public.chat_channels;
CREATE POLICY "chat_channels_select_staff_or_dm_member"
  ON public.chat_channels FOR SELECT TO authenticated
  USING (
    (is_dm = false AND public.is_staff())
    OR (is_dm = true AND auth.uid() = ANY(dm_user_ids))
  );

DROP POLICY IF EXISTS "chat_channels_insert_authenticated" ON public.chat_channels;
CREATE POLICY "chat_channels_insert_staff_or_dm_self"
  ON public.chat_channels FOR INSERT TO authenticated
  WITH CHECK (
    (is_dm = false AND auth.uid() = created_by AND public.is_staff())
    OR (is_dm = true AND auth.uid() = ANY(dm_user_ids))
  );

DROP POLICY IF EXISTS "chat_messages_select_visible_channels" ON public.chat_messages;
CREATE POLICY "chat_messages_select_visible_channels"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = chat_messages.channel_id
        AND (
          (c.is_dm = false AND public.is_staff())
          OR (c.is_dm = true AND auth.uid() = ANY(c.dm_user_ids))
        )
    )
  );

DROP POLICY IF EXISTS "chat_messages_insert_self_in_visible_channel" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_self_in_visible_channel"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = chat_messages.channel_id
        AND (
          (c.is_dm = false AND public.is_staff())
          OR (c.is_dm = true AND auth.uid() = ANY(c.dm_user_ids))
        )
    )
  );

-- Reactions: same visibility rules as messages.
DROP POLICY IF EXISTS "chat_message_reactions_select" ON public.chat_message_reactions;
CREATE POLICY "chat_message_reactions_select"
  ON public.chat_message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_channels c ON c.id = m.channel_id
      WHERE m.id = chat_message_reactions.message_id
        AND (
          (c.is_dm = false AND public.is_staff())
          OR (c.is_dm = true AND auth.uid() = ANY(c.dm_user_ids))
        )
    )
  );

DROP POLICY IF EXISTS "chat_message_reactions_insert_self" ON public.chat_message_reactions;
CREATE POLICY "chat_message_reactions_insert_self"
  ON public.chat_message_reactions FOR INSERT TO authenticated
  WITH CHECK (
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

-- ============================================================
-- 4. chat_messages_update_own — restrict mutable columns + pinned
--    Author may edit body / edited_at only. Pin metadata flips
--    only through SECURITY DEFINER chat_pin_message() (added below).
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_chat_messages_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_is_service boolean := current_setting('role', true) = 'service_role';
BEGIN
  IF caller_is_service THEN
    RETURN NEW;
  END IF;
  -- Force every immutable column back to OLD value.
  NEW.id := OLD.id;
  NEW.channel_id := OLD.channel_id;
  NEW.user_id := OLD.user_id;
  NEW.created_at := OLD.created_at;
  NEW.mentioned_user_ids := OLD.mentioned_user_ids;
  NEW.is_pinned := OLD.is_pinned;
  NEW.pinned_by := OLD.pinned_by;
  NEW.pinned_at := OLD.pinned_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_chat_messages_update ON public.chat_messages;
CREATE TRIGGER trg_guard_chat_messages_update
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_chat_messages_update();

-- Server-side pin RPC: only staff (admin/team/contractor/member) may pin.
CREATE OR REPLACE FUNCTION public.chat_pin_message(p_message_id uuid, p_pin boolean)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rec public.chat_messages;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.chat_messages
    SET is_pinned = p_pin,
        pinned_by = CASE WHEN p_pin THEN auth.uid() ELSE NULL END,
        pinned_at = CASE WHEN p_pin THEN now() ELSE NULL END
  WHERE id = p_message_id
  RETURNING * INTO rec;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found';
  END IF;
  RETURN rec;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.chat_pin_message(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_pin_message(uuid, boolean) TO authenticated;

-- ============================================================
-- 5. task_comments + task_attachments — staff-only (and remove
--    the catch-all "Allow all access" policy that survived).
-- ============================================================

DROP POLICY IF EXISTS "task_comments_select_authenticated" ON public.task_comments;
CREATE POLICY "task_comments_select_staff_only"
  ON public.task_comments FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "task_comments_insert_self" ON public.task_comments;
CREATE POLICY "task_comments_insert_staff_self"
  ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_staff());

-- Drop the broad catch-all that survived in the live DB.
DROP POLICY IF EXISTS "Allow all access to task_attachments" ON public.task_attachments;

DROP POLICY IF EXISTS "task_attachments_select_authenticated" ON public.task_attachments;
CREATE POLICY "task_attachments_select_staff_only"
  ON public.task_attachments FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "task_attachments_insert_authenticated" ON public.task_attachments;
CREATE POLICY "task_attachments_insert_staff_self"
  ON public.task_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by AND public.is_staff());

-- ============================================================
-- 6. project_phases — team_read_phases was effectively USING(true)
-- ============================================================

DROP POLICY IF EXISTS "team_read_phases" ON public.project_phases;
CREATE POLICY "team_read_phases"
  ON public.project_phases FOR SELECT TO authenticated
  USING (public.is_staff());

-- ============================================================
-- 7. social_posts — clients_approve_own_social_posts must not let
--    a client rewrite body / scheduled_at / media etc.
--    Guard via BEFORE UPDATE trigger that pins immutable columns.
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_social_posts_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role text := current_setting('role', true);
  caller_user_role text;
BEGIN
  IF caller_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT up.role INTO caller_user_role
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  -- Staff updates: untouched.
  IF caller_user_role IN ('admin','team','contractor','member') THEN
    RETURN NEW;
  END IF;

  -- For clients (and any other non-staff role), pin every column except the
  -- approval-related ones to OLD. Clients may flip `approved` and edit
  -- `notes` (their approval comment); everything else is staff-owned.
  NEW.id := OLD.id;
  NEW.client_id := OLD.client_id;
  NEW.title := OLD.title;
  NEW.content := OLD.content;
  NEW.platforms := OLD.platforms;
  NEW.scheduled_date := OLD.scheduled_date;
  NEW.status := OLD.status;
  NEW.image_url := OLD.image_url;
  NEW.hashtags := OLD.hashtags;
  NEW.link_url := OLD.link_url;
  NEW.assigned_to := OLD.assigned_to;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_social_posts_client_update ON public.social_posts;
CREATE TRIGGER trg_guard_social_posts_client_update
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_social_posts_client_update();

-- ============================================================
-- 8. client_accessible_accounts — switch view to SECURITY INVOKER
--    so it respects RLS on contacts.
-- ============================================================

CREATE OR REPLACE VIEW public.client_accessible_accounts
WITH (security_invoker = true) AS
SELECT DISTINCT c.account_id
FROM public.contacts c
WHERE c.portal_user_id = auth.uid();

-- ============================================================
-- 9. SECURITY DEFINER hygiene — set search_path on functions
--    that lacked it, and REVOKE EXECUTE from anon/authenticated
--    where the function should be trigger- or service-only.
-- ============================================================

-- Add search_path safety to existing definer functions (no behavior change).
DO $$
DECLARE
  fn record;
  fns text[] := ARRAY[
    'public._notify_if_missing',
    'public.run_notification_checks',
    'public._next_task_due_date',
    'public.generate_next_recurring_task',
    'public._create_next_recurring_task_from_source',
    'public.generate_scheduled_recurring_tasks',
    'public.check_due_date_reminders',
    'public.should_send_notification_email',
    'public.notify_email_on_notification',
    'public.update_project_phases_updated_at',
    'public.toggl_settings_touch_updated_at',
    'public.touch_chat_channels_updated_at',
    'public.touch_task_comments_updated_at',
    'public.is_admin',
    'public.handle_new_user_team_member',
    'public.handle_new_user',
    'public.update_last_sign_in'
  ];
  fn_name text;
BEGIN
  FOREACH fn_name IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s() SET search_path = ''''', fn_name);
    EXCEPTION WHEN undefined_function OR ambiguous_function THEN
      -- Function not present in this DB or has args — skip; nothing else
      -- in this migration depends on it.
      NULL;
    END;
  END LOOP;
END $$;

-- REVOKE EXECUTE on functions that should be trigger- or service-only.
DO $$
DECLARE
  fn_name text;
  fns text[] := ARRAY[
    'public.guard_user_profiles_role()',
    'public.guard_chat_messages_update()',
    'public.guard_social_posts_client_update()',
    'public.handle_new_user()',
    'public.handle_new_user_team_member()',
    'public.notify_email_on_notification()',
    'public.update_last_sign_in()',
    'public.touch_chat_channels_updated_at()',
    'public.touch_task_comments_updated_at()',
    'public.toggl_settings_touch_updated_at()',
    'public.update_project_phases_updated_at()',
    'public._notify_if_missing(uuid, text, text, text, text, jsonb, text, interval)',
    'public.check_due_date_reminders()',
    'public.generate_next_recurring_task()',
    'public.generate_scheduled_recurring_tasks()',
    'public._create_next_recurring_task_from_source(uuid)',
    'public._next_task_due_date(timestamptz, text)',
    'public.run_notification_checks()'
  ];
BEGIN
  FOREACH fn_name IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', fn_name);
    EXCEPTION WHEN undefined_function OR ambiguous_function THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- 10. notifications.dedupe_key — unique index so concurrent
--     _notify_if_missing calls cannot create duplicates.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_unique
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- ============================================================
-- 11. huddle_leave — read post-update state to avoid stuck-open
--     huddles when two leaves race.
-- ============================================================

CREATE OR REPLACE FUNCTION public.huddle_leave(huddle_id uuid)
RETURNS int
LANGUAGE sql
VOLATILE
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
SET search_path = ''
AS $$
  UPDATE public.huddles
    SET participant_count = participant_count + 1
  WHERE id = huddle_id AND ended_at IS NULL
  RETURNING participant_count;
$$;

-- ============================================================
-- 12. invoices: paid_at timestamp + tasks/leads completion timestamps
--     so KPI bucketing can use immutable transition dates rather than
--     issue_date / updated_at (any later edit re-buckets).
-- ============================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ;

-- Backfill from existing rows where status is already at the terminal value.
UPDATE public.invoices
  SET paid_at = COALESCE(paid_at, updated_at, created_at)
  WHERE status = 'paid' AND paid_at IS NULL;

UPDATE public.tasks
  SET completed_at = COALESCE(completed_at, updated_at, created_at)
  WHERE status = 'completed' AND completed_at IS NULL;

UPDATE public.leads
  SET won_at = COALESCE(won_at, updated_at, created_at)
  WHERE status = 'won' AND won_at IS NULL;

-- Stamp the timestamp on every status transition to the terminal value.
CREATE OR REPLACE FUNCTION public.stamp_invoice_paid_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'paid'
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'paid')
     AND NEW.paid_at IS NULL THEN
    NEW.paid_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_invoice_paid_at ON public.invoices;
CREATE TRIGGER trg_stamp_invoice_paid_at
  BEFORE INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.stamp_invoice_paid_at();

CREATE OR REPLACE FUNCTION public.stamp_task_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed')
     AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  IF NEW.status <> 'completed' AND OLD IS NOT NULL AND OLD.status = 'completed' THEN
    -- Task moved back out of completed; clear the timestamp so a later
    -- re-completion stamps the new transition.
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_task_completed_at ON public.tasks;
CREATE TRIGGER trg_stamp_task_completed_at
  BEFORE INSERT OR UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.stamp_task_completed_at();

CREATE OR REPLACE FUNCTION public.stamp_lead_won_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'won'
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'won')
     AND NEW.won_at IS NULL THEN
    NEW.won_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_lead_won_at ON public.leads;
CREATE TRIGGER trg_stamp_lead_won_at
  BEFORE INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.stamp_lead_won_at();

-- ============================================================
-- 13. stripe_webhook_events — idempotency table for replay protection
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT policies for non-service callers: this table is only
-- written by the webhook (service role bypasses RLS).
