-- Recurring tasks support

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_mode text NOT NULL DEFAULT 'on_complete',
  ADD COLUMN IF NOT EXISTS recurrence_frequency text,
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS recurrence_count integer,
  ADD COLUMN IF NOT EXISTS recurrence_generated_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_task_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_parent_task_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_parent_task_id_fkey
      FOREIGN KEY (parent_task_id)
      REFERENCES public.tasks(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_enabled ON public.tasks(recurrence_enabled);

CREATE OR REPLACE FUNCTION public._next_task_due_date(
  p_due_date date,
  p_frequency text,
  p_interval integer
)
RETURNS date
LANGUAGE plpgsql
AS $$
DECLARE
  base_date date := coalesce(p_due_date, current_date);
  step integer := greatest(coalesce(p_interval, 1), 1);
BEGIN
  IF p_frequency = 'daily' THEN
    RETURN base_date + make_interval(days => step);
  ELSIF p_frequency = 'weekly' THEN
    RETURN base_date + make_interval(days => (7 * step));
  ELSIF p_frequency = 'monthly' THEN
    RETURN (base_date + make_interval(months => step))::date;
  ELSIF p_frequency = 'quarterly' THEN
    RETURN (base_date + make_interval(months => (3 * step)))::date;
  ELSIF p_frequency = 'yearly' THEN
    RETURN (base_date + make_interval(years => step))::date;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_next_recurring_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_due date;
  next_count integer;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'completed' OR NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.recurrence_enabled, false) = false THEN
    RETURN NEW;
  END IF;

  IF NEW.recurrence_frequency IS NULL THEN
    RETURN NEW;
  END IF;

  next_due := public._next_task_due_date(NEW.due_date, NEW.recurrence_frequency, NEW.recurrence_interval);
  next_count := coalesce(NEW.recurrence_generated_count, 0) + 1;

  IF next_due IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.recurrence_end_date IS NOT NULL AND next_due > NEW.recurrence_end_date THEN
    RETURN NEW;
  END IF;

  IF NEW.recurrence_count IS NOT NULL AND next_count > NEW.recurrence_count THEN
    RETURN NEW;
  END IF;

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
    recurrence_frequency,
    recurrence_interval,
    recurrence_end_date,
    recurrence_count,
    recurrence_generated_count,
    parent_task_id
  ) VALUES (
    NEW.title,
    NEW.description,
    NEW.project_id,
    NEW.assigned_to,
    'todo',
    NEW.priority,
    NEW.estimated_hours,
    next_due,
    NEW.recurrence_enabled,
    NEW.recurrence_frequency,
    NEW.recurrence_interval,
    NEW.recurrence_end_date,
    NEW.recurrence_count,
    next_count,
    coalesce(NEW.parent_task_id, NEW.id)
  );

  NEW.recurrence_generated_count := next_count;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_next_recurring_task ON public.tasks;
CREATE TRIGGER trg_generate_next_recurring_task
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_next_recurring_task();
