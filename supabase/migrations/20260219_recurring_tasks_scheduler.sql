-- Calendar/schedule-based recurring task generation

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_mode text NOT NULL DEFAULT 'on_complete';

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_mode ON public.tasks(recurrence_mode);

CREATE OR REPLACE FUNCTION public._create_next_recurring_task_from_source(p_source_task public.tasks)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_due date;
  root_id uuid;
  next_count integer;
BEGIN
  IF coalesce(p_source_task.recurrence_enabled, false) = false
     OR p_source_task.recurrence_frequency IS NULL THEN
    RETURN false;
  END IF;

  next_due := public._next_task_due_date(
    p_source_task.due_date,
    p_source_task.recurrence_frequency,
    p_source_task.recurrence_interval
  );

  IF next_due IS NULL THEN
    RETURN false;
  END IF;

  next_count := coalesce(p_source_task.recurrence_generated_count, 0) + 1;

  IF p_source_task.recurrence_end_date IS NOT NULL AND next_due > p_source_task.recurrence_end_date THEN
    RETURN false;
  END IF;

  IF p_source_task.recurrence_count IS NOT NULL AND next_count > p_source_task.recurrence_count THEN
    RETURN false;
  END IF;

  root_id := coalesce(p_source_task.parent_task_id, p_source_task.id);

  INSERT INTO public.tasks (
    title,
    description,
    project_id,
    assigned_to,
    status,
    priority,
    estimated_hours,
    due_date,
    recurrence_enabled,
    recurrence_mode,
    recurrence_frequency,
    recurrence_interval,
    recurrence_end_date,
    recurrence_count,
    recurrence_generated_count,
    parent_task_id
  ) VALUES (
    p_source_task.title,
    p_source_task.description,
    p_source_task.project_id,
    p_source_task.assigned_to,
    'todo',
    p_source_task.priority,
    p_source_task.estimated_hours,
    next_due,
    p_source_task.recurrence_enabled,
    p_source_task.recurrence_mode,
    p_source_task.recurrence_frequency,
    p_source_task.recurrence_interval,
    p_source_task.recurrence_end_date,
    p_source_task.recurrence_count,
    next_count,
    root_id
  );

  UPDATE public.tasks
  SET recurrence_generated_count = next_count,
      updated_at = now()
  WHERE id = p_source_task.id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_next_recurring_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  created_next boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'completed' OR NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.recurrence_mode, 'on_complete') <> 'on_complete' THEN
    RETURN NEW;
  END IF;

  created_next := public._create_next_recurring_task_from_source(NEW);
  IF created_next THEN
    NEW.recurrence_generated_count := coalesce(NEW.recurrence_generated_count, 0) + 1;
  END IF;

  RETURN NEW;
END;
$$;

-- For calendar mode: generate upcoming occurrences when due date passes,
-- regardless of whether previous task is completed.
CREATE OR REPLACE FUNCTION public.generate_scheduled_recurring_tasks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  source_task public.tasks%ROWTYPE;
  generated integer := 0;
BEGIN
  FOR source_task IN
    SELECT t.*
    FROM public.tasks t
    WHERE coalesce(t.recurrence_enabled, false) = true
      AND coalesce(t.recurrence_mode, 'on_complete') = 'calendar'
      AND t.recurrence_frequency IS NOT NULL
      AND t.due_date IS NOT NULL
      AND t.due_date <= current_date
      AND t.status <> 'completed'
  LOOP
    -- Catch up generation: keep creating until next due date is in future
    WHILE source_task.due_date <= current_date LOOP
      EXIT WHEN NOT public._create_next_recurring_task_from_source(source_task);

      SELECT *
      INTO source_task
      FROM public.tasks
      WHERE parent_task_id = coalesce(source_task.parent_task_id, source_task.id)
         OR id = source_task.id
      ORDER BY due_date DESC NULLS LAST, created_at DESC
      LIMIT 1;

      generated := generated + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'generated', generated, 'ran_at', now());
END;
$$;

-- Optional cron:
-- SELECT cron.schedule('recurring-task-scheduler-hourly', '0 * * * *', $$SELECT public.generate_scheduled_recurring_tasks();$$);
