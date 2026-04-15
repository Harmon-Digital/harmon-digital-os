-- Phase 4: reactions + pinned messages

-- Reactions: one row per (message, user, emoji)
create table if not exists chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists chat_message_reactions_message_idx
  on chat_message_reactions(message_id);

alter table chat_message_reactions enable row level security;

-- Reactions are visible to anyone who can see the message's channel.
create policy "chat_message_reactions_select"
  on chat_message_reactions for select
  to authenticated
  using (
    exists (
      select 1 from chat_messages m
      join chat_channels c on c.id = m.channel_id
      where m.id = chat_message_reactions.message_id
        and (c.is_dm = false or auth.uid() = any(c.dm_user_ids))
    )
  );

create policy "chat_message_reactions_insert_self"
  on chat_message_reactions for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from chat_messages m
      join chat_channels c on c.id = m.channel_id
      where m.id = chat_message_reactions.message_id
        and (c.is_dm = false or auth.uid() = any(c.dm_user_ids))
    )
  );

create policy "chat_message_reactions_delete_own"
  on chat_message_reactions for delete
  to authenticated
  using (auth.uid() = user_id);

alter publication supabase_realtime add table chat_message_reactions;

-- Pinned messages: a channel can have any number of pinned messages.
alter table chat_messages
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_by uuid references auth.users(id) on delete set null,
  add column if not exists pinned_at timestamptz;

create index if not exists chat_messages_pinned_idx
  on chat_messages(channel_id, pinned_at desc)
  where is_pinned = true;
