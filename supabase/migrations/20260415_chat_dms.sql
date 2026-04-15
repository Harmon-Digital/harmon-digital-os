-- Phase 2: direct messages (1-on-1 channels)
-- Extends chat_channels with is_dm + sorted participant array.
-- Tightens RLS so non-participants cannot read DM channels or messages.

alter table chat_channels
  add column if not exists is_dm boolean not null default false,
  add column if not exists dm_user_ids uuid[] not null default '{}';

-- Exactly one DM channel per ordered pair of users.
create unique index if not exists chat_channels_dm_pair_unique
  on chat_channels (dm_user_ids)
  where is_dm = true;

-- Basic sanity: DMs must have exactly 2 participants; non-DMs must have none.
alter table chat_channels
  drop constraint if exists chat_channels_dm_shape_check;
alter table chat_channels
  add constraint chat_channels_dm_shape_check
  check (
    (is_dm = true  and array_length(dm_user_ids, 1) = 2)
    or
    (is_dm = false and array_length(dm_user_ids, 1) is null)
  );

-- Replace SELECT policy: hide DMs from non-participants.
drop policy if exists "chat_channels_select_authenticated" on chat_channels;
create policy "chat_channels_select_participants_or_public"
  on chat_channels for select
  to authenticated
  using (
    is_dm = false
    or auth.uid() = any(dm_user_ids)
  );

-- DM channels are created by participants; non-DM channels by creator as before.
drop policy if exists "chat_channels_insert_authenticated" on chat_channels;
create policy "chat_channels_insert_authenticated"
  on chat_channels for insert
  to authenticated
  with check (
    (is_dm = false and auth.uid() = created_by)
    or
    (is_dm = true and auth.uid() = any(dm_user_ids))
  );

-- Tighten messages so only channel-visible users can read/post.
drop policy if exists "chat_messages_select_authenticated" on chat_messages;
create policy "chat_messages_select_visible_channels"
  on chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from chat_channels c
      where c.id = chat_messages.channel_id
        and (c.is_dm = false or auth.uid() = any(c.dm_user_ids))
    )
  );

drop policy if exists "chat_messages_insert_self" on chat_messages;
create policy "chat_messages_insert_self_in_visible_channel"
  on chat_messages for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from chat_channels c
      where c.id = chat_messages.channel_id
        and (c.is_dm = false or auth.uid() = any(c.dm_user_ids))
    )
  );
