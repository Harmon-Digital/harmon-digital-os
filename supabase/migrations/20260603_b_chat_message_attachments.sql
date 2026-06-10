-- chat_message_attachments was added directly to the live DB earlier and the
-- RLS policies in 20260604_rls_consistency_fixes.sql reference it, but no
-- migration creates the table. A fresh checkout / `db reset` would fail when
-- 20260604 runs, because the policy targets a non-existent table.
--
-- Make the table definition explicit. All DDL is idempotent (`create ... if
-- not exists`, `create index if not exists`) so re-running on prod is a no-op
-- — the existing rows, indexes, and FKs are left untouched.

create table if not exists chat_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references chat_messages(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_path text not null,
  file_type text,
  file_size integer,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_attachments_message
  on chat_message_attachments(message_id);

alter table chat_message_attachments enable row level security;

-- Policies for this table live in 20260604_rls_consistency_fixes.sql and
-- enforce parent-message visibility. They are not duplicated here.
