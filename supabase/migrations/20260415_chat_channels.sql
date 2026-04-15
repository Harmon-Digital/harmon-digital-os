-- User-to-user chat (Phase 1: public channels only)
-- Parallel to bot_channels/bot_messages to keep bot chat untouched.

create table if not exists chat_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_archived boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists chat_channels_name_active_unique
  on chat_channels (lower(name))
  where is_archived = false;

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references chat_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  mentioned_user_ids uuid[] not null default '{}',
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_channel_created_idx
  on chat_messages(channel_id, created_at);
create index if not exists chat_messages_user_id_idx
  on chat_messages(user_id);

alter table chat_channels enable row level security;
alter table chat_messages enable row level security;

-- Channels: any authenticated user can read and create; update/delete is admin-or-creator.
create policy "chat_channels_select_authenticated"
  on chat_channels for select
  to authenticated
  using (true);

create policy "chat_channels_insert_authenticated"
  on chat_channels for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "chat_channels_update_creator_or_admin"
  on chat_channels for update
  to authenticated
  using (
    auth.uid() = created_by
    or exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid() and user_profiles.role = 'admin'
    )
  );

create policy "chat_channels_delete_creator_or_admin"
  on chat_channels for delete
  to authenticated
  using (
    auth.uid() = created_by
    or exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid() and user_profiles.role = 'admin'
    )
  );

-- Messages: any authenticated user can read and post; author can edit/delete own; admin can delete any.
create policy "chat_messages_select_authenticated"
  on chat_messages for select
  to authenticated
  using (true);

create policy "chat_messages_insert_self"
  on chat_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "chat_messages_update_own"
  on chat_messages for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "chat_messages_delete_own_or_admin"
  on chat_messages for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid() and user_profiles.role = 'admin'
    )
  );

-- Auto-update updated_at on chat_channels
create or replace function touch_chat_channels_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists chat_channels_touch_updated_at on chat_channels;
create trigger chat_channels_touch_updated_at
  before update on chat_channels
  for each row execute function touch_chat_channels_updated_at();

-- Realtime
alter publication supabase_realtime add table chat_messages;
alter publication supabase_realtime add table chat_channels;

-- Seed a default "general" channel if empty
insert into chat_channels (name, description, created_by)
select 'general', 'Team-wide discussion', null
where not exists (select 1 from chat_channels);
