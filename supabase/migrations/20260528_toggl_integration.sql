-- Toggl Track integration: schema for one-way sync from Toggl into Harmon Digital OS.
--
-- Strategy:
--   * Toggl is the source of truth for time entries the team logs in Toggl Track.
--   * Each synced HDO row carries the upstream toggl_id so re-runs are idempotent
--     (upsert on toggl_id rather than create-duplicate).
--   * Existing HDO rows (accounts, projects, team_members) can be back-linked to
--     a Toggl entity by setting toggl_id manually; the sync will then update them
--     in place instead of creating a parallel record.
--   * One singleton row in toggl_settings holds workspace_id + the cursor used
--     for incremental sync. Backfills run by overriding backfill_from on demand.

create table if not exists public.toggl_settings (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       bigint,                  -- Toggl numeric workspace id
  default_account_id uuid references public.accounts(id) on delete set null,
  default_team_member_id uuid references public.team_members(id) on delete set null,
  last_sync_at       timestamptz,
  last_sync_status   text,                    -- 'ok' | 'error' | 'running'
  last_sync_error    text,
  last_sync_summary  jsonb,                   -- { clients, projects, users, entries, skipped }
  backfill_from      date,                    -- if set, next sync pulls entries >= this date
  enabled            boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Enforce a single settings row.
create unique index if not exists toggl_settings_singleton
  on public.toggl_settings ((true));

alter table public.toggl_settings enable row level security;

-- Only admins read / write settings (matches mcp_api_keys pattern).
drop policy if exists "toggl_settings admin all" on public.toggl_settings;
create policy "toggl_settings admin all"
  on public.toggl_settings
  for all
  to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid() and tm.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid() and tm.role = 'admin'
    )
  );

-- Per-run log so the admin UI can show recent sync history without bloating settings.
create table if not exists public.toggl_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running',  -- 'running' | 'ok' | 'error'
  trigger       text not null default 'manual',   -- 'manual' | 'cron' | 'backfill'
  triggered_by  uuid references auth.users(id) on delete set null,
  range_from    date,
  range_to      date,
  summary       jsonb,
  error         text
);

create index if not exists toggl_sync_runs_started_idx
  on public.toggl_sync_runs (started_at desc);

alter table public.toggl_sync_runs enable row level security;

drop policy if exists "toggl_sync_runs admin read" on public.toggl_sync_runs;
create policy "toggl_sync_runs admin read"
  on public.toggl_sync_runs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid() and tm.role = 'admin'
    )
  );

-- Mapping columns on existing tables. All nullable so existing data is untouched
-- until the sync (or an admin) links a row.

alter table public.accounts      add column if not exists toggl_id text;
alter table public.accounts      add column if not exists toggl_synced_at timestamptz;
create unique index if not exists accounts_toggl_id_uniq
  on public.accounts (toggl_id) where toggl_id is not null;

alter table public.projects      add column if not exists toggl_id text;
alter table public.projects      add column if not exists toggl_synced_at timestamptz;
create unique index if not exists projects_toggl_id_uniq
  on public.projects (toggl_id) where toggl_id is not null;

alter table public.team_members  add column if not exists toggl_id text;
alter table public.team_members  add column if not exists toggl_synced_at timestamptz;
create unique index if not exists team_members_toggl_id_uniq
  on public.team_members (toggl_id) where toggl_id is not null;

alter table public.time_entries  add column if not exists toggl_id text;
alter table public.time_entries  add column if not exists toggl_synced_at timestamptz;
alter table public.time_entries  add column if not exists toggl_tags text[];
create unique index if not exists time_entries_toggl_id_uniq
  on public.time_entries (toggl_id) where toggl_id is not null;

-- Helper trigger to bump updated_at on toggl_settings edits.
create or replace function public.toggl_settings_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists toggl_settings_touch on public.toggl_settings;
create trigger toggl_settings_touch
  before update on public.toggl_settings
  for each row execute function public.toggl_settings_touch_updated_at();
