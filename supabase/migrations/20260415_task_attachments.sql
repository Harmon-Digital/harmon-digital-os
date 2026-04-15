-- Task attachments
create table if not exists task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  file_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists task_attachments_task_id_idx on task_attachments(task_id);
create index if not exists task_attachments_uploaded_by_idx on task_attachments(uploaded_by);

alter table task_attachments enable row level security;

-- Authenticated users can read all attachments
create policy "task_attachments_select_authenticated"
  on task_attachments for select
  to authenticated
  using (true);

-- Authenticated users can insert attachments (as themselves)
create policy "task_attachments_insert_authenticated"
  on task_attachments for insert
  to authenticated
  with check (auth.uid() = uploaded_by);

-- Uploader or admin can delete
create policy "task_attachments_delete_uploader_or_admin"
  on task_attachments for delete
  to authenticated
  using (
    auth.uid() = uploaded_by
    or exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.role = 'admin'
    )
  );
