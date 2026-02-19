-- Cleanup: remove external integration linkage for Harmon Bot channel (OS-only)

DROP TABLE IF EXISTS public.bot_channel_integrations CASCADE;

-- Ensure bot channel is explicitly internal-only
UPDATE public.bot_channels
SET kind = 'internal',
    updated_at = now()
WHERE name = 'harmon-bot';
