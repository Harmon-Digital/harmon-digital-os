-- Notification center robustness upgrade
-- Adds richer notification metadata + per-user email preferences

-- 1) Extend notifications table (safe additive fields)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS email_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_category_created
  ON public.notifications (category, created_at DESC);

-- 2) Notification preferences (email routing controls)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  immediate_types text[] NOT NULL DEFAULT ARRAY['error','warning'],
  muted_categories text[] NOT NULL DEFAULT ARRAY[]::text[],
  daily_digest_enabled boolean NOT NULL DEFAULT false,
  social_kpi_enabled boolean NOT NULL DEFAULT true,
  task_enabled boolean NOT NULL DEFAULT true,
  crm_enabled boolean NOT NULL DEFAULT true,
  referral_enabled boolean NOT NULL DEFAULT true,
  finance_enabled boolean NOT NULL DEFAULT true,
  system_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'Users can read own notification preferences'
  ) THEN
    CREATE POLICY "Users can read own notification preferences"
      ON public.notification_preferences
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'Users can upsert own notification preferences'
  ) THEN
    CREATE POLICY "Users can upsert own notification preferences"
      ON public.notification_preferences
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'Users can update own notification preferences'
  ) THEN
    CREATE POLICY "Users can update own notification preferences"
      ON public.notification_preferences
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3) Email decision function
CREATE OR REPLACE FUNCTION public.should_send_notification_email(
  p_user_id uuid,
  p_type text,
  p_category text,
  p_email_enabled boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  prefs record;
BEGIN
  IF coalesce(p_email_enabled, true) = false THEN
    RETURN false;
  END IF;

  SELECT * INTO prefs
  FROM public.notification_preferences
  WHERE user_id = p_user_id;

  -- No explicit preferences => default to sending
  IF prefs IS NULL THEN
    RETURN true;
  END IF;

  IF prefs.email_enabled = false THEN
    RETURN false;
  END IF;

  IF p_category IS NOT NULL AND p_category = ANY(coalesce(prefs.muted_categories, ARRAY[]::text[])) THEN
    RETURN false;
  END IF;

  -- Always send urgent types immediately unless globally disabled
  IF p_type = ANY(coalesce(prefs.immediate_types, ARRAY[]::text[])) THEN
    RETURN true;
  END IF;

  IF p_category = 'social' AND prefs.social_kpi_enabled = false THEN
    RETURN false;
  ELSIF p_category = 'tasks' AND prefs.task_enabled = false THEN
    RETURN false;
  ELSIF p_category = 'crm' AND prefs.crm_enabled = false THEN
    RETURN false;
  ELSIF p_category = 'referrals' AND prefs.referral_enabled = false THEN
    RETURN false;
  ELSIF p_category = 'finance' AND prefs.finance_enabled = false THEN
    RETURN false;
  ELSIF p_category = 'system' AND prefs.system_enabled = false THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- 4) Trigger: only email when preference check passes
CREATE OR REPLACE FUNCTION public.notify_email_on_notification()
RETURNS trigger AS $$
BEGIN
  IF public.should_send_notification_email(NEW.user_id, NEW.type, NEW.category, NEW.email_enabled) THEN
    PERFORM net.http_post(
      url := 'https://ctfichbfoligaiabudjv.supabase.co/functions/v1/send-notification-email',
      body := jsonb_build_object('record', row_to_json(NEW)),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Email notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
