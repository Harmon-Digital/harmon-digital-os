-- Phase 3: per-user read receipts (unread badges).
-- Presence is handled by Supabase Realtime presence channels; no DB needed.

create table if not exists chat_channel_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid not null references chat_channels(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

create index if not exists chat_channel_reads_user_idx
  on chat_channel_reads(user_id);

alter table chat_channel_reads enable row level security;

create policy "chat_channel_reads_select_own"
  on chat_channel_reads for select
  to authenticated
  using (auth.uid() = user_id);

create policy "chat_channel_reads_insert_own"
  on chat_channel_reads for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "chat_channel_reads_update_own"
  on chat_channel_reads for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "chat_channel_reads_delete_own"
  on chat_channel_reads for delete
  to authenticated
  using (auth.uid() = user_id);
