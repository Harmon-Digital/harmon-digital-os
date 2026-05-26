-- Atomically increment participant_count and return the new value
create or replace function huddle_join(huddle_id uuid)
returns int as $$
  update huddles
    set participant_count = participant_count + 1
  where id = huddle_id and ended_at is null
  returning participant_count;
$$ language sql volatile;

-- Atomically decrement participant_count; auto-close the huddle when it reaches 0
create or replace function huddle_leave(huddle_id uuid)
returns int as $$
  update huddles
    set participant_count = greatest(participant_count - 1, 0),
        ended_at = case when participant_count <= 1 then now() else ended_at end
  where id = huddle_id and ended_at is null
  returning participant_count;
$$ language sql volatile;
