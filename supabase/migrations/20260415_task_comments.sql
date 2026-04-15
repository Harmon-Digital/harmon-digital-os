-- Task comments
create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_comments_task_id_idx on task_comments(task_id, created_at);
create index if not exists task_comments_user_id_idx on task_comments(user_id);

alter table task_comments enable row level security;

create policy "task_comments_select_authenticated"
  on task_comments for select
  to authenticated
  using (true);

create policy "task_comments_insert_self"
  on task_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "task_comments_update_own"
  on task_comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "task_comments_delete_own_or_admin"
  on task_comments for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.role = 'admin'
    )
  );

-- Auto-update updated_at on any change
create or replace function touch_task_comments_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists task_comments_touch_updated_at on task_comments;
create trigger task_comments_touch_updated_at
  before update on task_comments
  for each row execute function touch_task_comments_updated_at();
