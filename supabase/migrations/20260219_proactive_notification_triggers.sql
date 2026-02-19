-- Proactive notification checks for core ops signals

CREATE OR REPLACE FUNCTION public._notify_if_missing(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_link text,
  p_category text,
  p_priority text,
  p_source text,
  p_dedupe_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = p_user_id
      AND n.dedupe_key = p_dedupe_key
      AND n.created_at >= (now() - interval '24 hours')
  ) THEN
    INSERT INTO public.notifications (
      user_id, type, title, message, link, category, priority, source, dedupe_key, read
    )
    VALUES (
      p_user_id, p_type, p_title, p_message, p_link, p_category, p_priority, p_source, p_dedupe_key, false
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_notification_checks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_created integer := 0;
  admin_rec record;
  task_rec record;
  social_rec record;
  kpi_rec record;
  inv_rec record;
  dedupe text;
BEGIN
  -- 1) Task due/overdue reminders (assigned users)
  FOR task_rec IN
    SELECT t.id, t.title, t.due_date, tm.user_id
    FROM public.tasks t
    JOIN public.team_members tm ON tm.id = t.assigned_to
    WHERE t.status <> 'completed'
      AND t.assigned_to IS NOT NULL
      AND t.due_date IS NOT NULL
      AND t.due_date <= (current_date + 1)
  LOOP
    dedupe := 'task:' || task_rec.id || ':' || task_rec.due_date::text;

    PERFORM public._notify_if_missing(
      task_rec.user_id,
      CASE WHEN task_rec.due_date < current_date THEN 'error' ELSE 'warning' END,
      CASE
        WHEN task_rec.due_date < current_date THEN 'Task overdue'
        WHEN task_rec.due_date = current_date THEN 'Task due today'
        ELSE 'Task due tomorrow'
      END,
      '"' || coalesce(task_rec.title, 'Untitled task') || '" needs attention.',
      '/Tasks',
      'tasks',
      'high',
      'tasks.due_check',
      dedupe
    );
    v_created := v_created + 1;
  END LOOP;

  -- 2) Social media at-risk (scheduled today but not approved/published)
  FOR social_rec IN
    SELECT sp.id, sp.title, sp.scheduled_date, sp.status, coalesce(sp.approved, false) AS approved
    FROM public.social_posts sp
    WHERE sp.scheduled_date = current_date
      AND (sp.status IS DISTINCT FROM 'published')
      AND coalesce(sp.approved, false) = false
  LOOP
    FOR admin_rec IN
      SELECT id FROM public.user_profiles WHERE role = 'admin'
    LOOP
      dedupe := 'social-risk:' || social_rec.id || ':' || current_date::text;

      PERFORM public._notify_if_missing(
        admin_rec.id,
        'warning',
        'Social post needs review',
        'Scheduled today and not approved: ' || coalesce(social_rec.title, 'Untitled post'),
        '/SocialMedia',
        'social',
        'high',
        'social.approval_needed',
        dedupe
      );
      v_created := v_created + 1;
    END LOOP;
  END LOOP;

  -- 3) KPI lag signals (social KPI under target)
  FOR kpi_rec IN
    SELECT ke.id, ke.team_member_id, ke.actual_value, ke.target_value, tm.user_id
    FROM public.kpi_entries ke
    LEFT JOIN public.team_members tm ON tm.id = ke.team_member_id
    WHERE ke.slug = 'social_posts'
      AND coalesce(ke.target_value, 0) > 0
      AND coalesce(ke.actual_value, 0) < (coalesce(ke.target_value, 0) * 0.6)
      AND ke.month::date = date_trunc('week', now())::date
  LOOP
    FOR admin_rec IN
      SELECT id FROM public.user_profiles WHERE role = 'admin'
    LOOP
      dedupe := 'kpi-social:' || kpi_rec.id || ':' || current_date::text;

      PERFORM public._notify_if_missing(
        admin_rec.id,
        'warning',
        'Social KPI below threshold',
        'Current performance is below 60% of weekly social post target.',
        '/SocialMedia',
        'kpi',
        'normal',
        'kpi.social_threshold',
        dedupe
      );
      v_created := v_created + 1;
    END LOOP;
  END LOOP;

  -- 4) Finance risk: overdue invoices
  FOR inv_rec IN
    SELECT i.id, i.invoice_number, i.due_date, i.status, i.total
    FROM public.invoices i
    WHERE i.due_date < current_date
      AND i.status IN ('sent', 'overdue', 'unpaid')
  LOOP
    FOR admin_rec IN
      SELECT id FROM public.user_profiles WHERE role = 'admin'
    LOOP
      dedupe := 'invoice-overdue:' || inv_rec.id || ':' || current_date::text;

      PERFORM public._notify_if_missing(
        admin_rec.id,
        'error',
        'Overdue invoice',
        'Invoice ' || coalesce(inv_rec.invoice_number, inv_rec.id::text) || ' is overdue.',
        '/StripeSync',
        'finance',
        'high',
        'finance.invoice_overdue',
        dedupe
      );
      v_created := v_created + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'notifications_checked', v_created, 'checked_at', now());
END;
$$;

-- Optional cron examples:
-- SELECT cron.schedule('notification-checks-hourly', '0 * * * *', $$SELECT public.run_notification_checks();$$);
-- SELECT cron.schedule('notification-checks-morning', '0 14 * * *', $$SELECT public.run_notification_checks();$$);
