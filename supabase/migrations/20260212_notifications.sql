-- Due date reminder function (runs via pg_cron daily at 8 AM CST / 14:00 UTC)
CREATE OR REPLACE FUNCTION public.check_due_date_reminders()
RETURNS void AS $$
DECLARE
  task_rec record;
  today date := current_date;
  tomorrow date := current_date + 1;
  notif_title text;
  notif_type text;
BEGIN
  FOR task_rec IN
    SELECT t.id, t.title, t.due_date, t.assigned_to, tm.user_id
    FROM tasks t
    JOIN team_members tm ON tm.id = t.assigned_to
    WHERE t.status != 'completed'
      AND t.due_date IS NOT NULL
      AND t.assigned_to IS NOT NULL
      AND t.due_date <= tomorrow
      AND tm.user_id IS NOT NULL
  LOOP
    IF task_rec.due_date < today THEN
      notif_title := 'Task Overdue';
      notif_type := 'error';
    ELSIF task_rec.due_date = today THEN
      notif_title := 'Task Due Today';
      notif_type := 'warning';
    ELSE
      notif_title := 'Task Due Tomorrow';
      notif_type := 'warning';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = task_rec.user_id
        AND created_at >= today::timestamp
        AND title = notif_title
        AND message LIKE '%' || left(task_rec.title, 30) || '%'
    ) THEN
      INSERT INTO notifications (user_id, type, title, message, link, read)
      VALUES (
        task_rec.user_id,
        notif_type,
        notif_title,
        '"' || task_rec.title || '" is ' || lower(notif_title),
        '/Tasks',
        false
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule: daily at 8 AM CST (14:00 UTC)
-- SELECT cron.schedule('due-date-reminders', '0 14 * * *', 'SELECT public.check_due_date_reminders()');

-- Email notification trigger (calls send-notification-email edge function via pg_net)
CREATE OR REPLACE FUNCTION public.notify_email_on_notification()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ctfichbfoligaiabudjv.supabase.co/functions/v1/send-notification-email',
    body := jsonb_build_object('record', row_to_json(NEW)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Email notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_notification_created ON notifications;
CREATE TRIGGER on_notification_created
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_email_on_notification();
