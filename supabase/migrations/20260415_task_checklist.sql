-- Lightweight subtasks stored as JSONB on the task row.
-- Shape: [{"id": "uuid", "text": "...", "done": false, "order": 0}]
alter table tasks
  add column if not exists checklist jsonb not null default '[]'::jsonb;
