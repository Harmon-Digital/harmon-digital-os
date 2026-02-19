-- Harmon Bot channel foundation (internal + external channel config)

CREATE TABLE IF NOT EXISTS public.bot_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'internal', -- internal|slack|discord|telegram|email
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bot_channel_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.bot_channels(id) ON DELETE CASCADE,
  provider text NOT NULL, -- slack|discord|telegram|webhook
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, provider)
);

CREATE TABLE IF NOT EXISTS public.bot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.bot_channels(id) ON DELETE CASCADE,
  role text NOT NULL, -- user|assistant|system
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_messages_channel_created
  ON public.bot_messages(channel_id, created_at DESC);

ALTER TABLE public.bot_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_channel_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bot_channels' AND policyname='Bot channels readable by authenticated'
  ) THEN
    CREATE POLICY "Bot channels readable by authenticated"
      ON public.bot_channels FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bot_channels' AND policyname='Bot channels writable by admins'
  ) THEN
    CREATE POLICY "Bot channels writable by admins"
      ON public.bot_channels FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bot_messages' AND policyname='Bot messages readable by authenticated'
  ) THEN
    CREATE POLICY "Bot messages readable by authenticated"
      ON public.bot_messages FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bot_messages' AND policyname='Bot messages insert by authenticated'
  ) THEN
    CREATE POLICY "Bot messages insert by authenticated"
      ON public.bot_messages FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id OR role IN ('assistant','system'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bot_channel_integrations' AND policyname='Bot integrations readable by authenticated'
  ) THEN
    CREATE POLICY "Bot integrations readable by authenticated"
      ON public.bot_channel_integrations FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bot_channel_integrations' AND policyname='Bot integrations writable by admins'
  ) THEN
    CREATE POLICY "Bot integrations writable by admins"
      ON public.bot_channel_integrations FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'));
  END IF;
END $$;

-- Seed default internal channel
INSERT INTO public.bot_channels (name, kind, is_active)
SELECT 'harmon-bot', 'internal', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.bot_channels WHERE name = 'harmon-bot' AND kind = 'internal'
);
