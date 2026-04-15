-- Notification center hardening + email pipeline fix.
--
-- Two problems this addresses:
-- 1. The 20260219_notification_center_upgrade migration was never actually
--    applied to production, so every `sendNotification()` insert in the app
--    was silently failing (columns like category/priority/email_enabled did
--    not exist, and the pg_net -> edge function trigger had no auth).
-- 2. A March 31 edge function change added a Bearer-token check against
--    SUPABASE_SERVICE_ROLE_KEY, but the trigger was sending an empty token,
--    so every email request returned 401.
--
-- The final shape:
--   * Notifications table has the richer columns the app assumes.
--   * Per-user notification_preferences table gates email routing.
--   * The trigger reads a shared secret from Supabase Vault (under the name
--     "notify_internal_secret") and sends it as the Bearer token. The
--     matching constant lives in the send-notification-email function.
--     Create the vault entry once manually (it must never land in git):
--       select vault.create_secret(
--         '<paste shared secret>',
--         'notify_internal_secret',
--         'Shared secret for pg_net -> send-notification-email calls'
--       );

-- 1) Notifications columns (additive, safe to re-run)
alter table public.notifications
  add column if not exists category text default 'general',
  add column if not exists priority text default 'normal',
  add column if not exists email_enabled boolean default true,
  add column if not exists source text,
  add column if not exists dedupe_key text;

create index if not exists idx_notifications_user_read_created
  on public.notifications (user_id, read, created_at desc);

create index if not exists idx_notifications_category_created
  on public.notifications (category, created_at desc);

-- 2) Per-user preferences
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  immediate_types text[] not null default array['error','warning'],
  muted_categories text[] not null default array[]::text[],
  daily_digest_enabled boolean not null default false,
  social_kpi_enabled boolean not null default true,
  task_enabled boolean not null default true,
  crm_enabled boolean not null default true,
  referral_enabled boolean not null default true,
  finance_enabled boolean not null default true,
  system_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notification_preferences'
      and policyname='Users can read own notification preferences'
  ) then
    create policy "Users can read own notification preferences"
      on public.notification_preferences for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notification_preferences'
      and policyname='Users can upsert own notification preferences'
  ) then
    create policy "Users can upsert own notification preferences"
      on public.notification_preferences for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notification_preferences'
      and policyname='Users can update own notification preferences'
  ) then
    create policy "Users can update own notification preferences"
      on public.notification_preferences for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- 3) Email routing gate
create or replace function public.should_send_notification_email(
  p_user_id uuid,
  p_type text,
  p_category text,
  p_email_enabled boolean
)
returns boolean
language plpgsql
security definer
as $$
declare
  prefs record;
begin
  if coalesce(p_email_enabled, true) = false then
    return false;
  end if;

  select * into prefs
  from public.notification_preferences
  where user_id = p_user_id;

  if prefs is null then
    return true;
  end if;

  if prefs.email_enabled = false then
    return false;
  end if;

  if p_category is not null and p_category = any(coalesce(prefs.muted_categories, array[]::text[])) then
    return false;
  end if;

  if p_type = any(coalesce(prefs.immediate_types, array[]::text[])) then
    return true;
  end if;

  if p_category = 'social' and prefs.social_kpi_enabled = false then
    return false;
  elsif p_category = 'tasks' and prefs.task_enabled = false then
    return false;
  elsif p_category = 'crm' and prefs.crm_enabled = false then
    return false;
  elsif p_category = 'referrals' and prefs.referral_enabled = false then
    return false;
  elsif p_category = 'finance' and prefs.finance_enabled = false then
    return false;
  elsif p_category = 'system' and prefs.system_enabled = false then
    return false;
  end if;

  return true;
end;
$$;

-- 4) Trigger: read shared secret from vault, call edge function with it.
create or replace function public.notify_email_on_notification()
returns trigger as $$
declare
  svc_key text;
begin
  if public.should_send_notification_email(new.user_id, new.type, new.category, new.email_enabled) then
    select decrypted_secret into svc_key
    from vault.decrypted_secrets
    where name = 'notify_internal_secret'
    limit 1;

    if svc_key is null or svc_key = '' then
      raise warning 'Email notification: notify_internal_secret not found in vault';
      return new;
    end if;

    perform net.http_post(
      url := 'https://ctfichbfoligaiabudjv.supabase.co/functions/v1/send-notification-email',
      body := jsonb_build_object('record', row_to_json(new)),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      )
    );
  end if;
  return new;
exception when others then
  raise warning 'Email notification failed: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_notification_created on public.notifications;
create trigger on_notification_created
  after insert on public.notifications
  for each row
  execute function public.notify_email_on_notification();
