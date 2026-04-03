import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRON_SECRET = Deno.env.get("CRON_SECRET");

Deno.serve(async (req) => {
  // Auth: require Authorization header with cron secret or service role key
  const authHeader = req.headers.get("authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!bearerToken || (bearerToken !== serviceKey && (!CRON_SECRET || bearerToken !== CRON_SECRET))) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [{ data: notificationsData, error: notificationsError }, { data: recurringData, error: recurringError }] = await Promise.all([
      supabase.rpc("run_notification_checks"),
      supabase.rpc("generate_scheduled_recurring_tasks"),
    ]);

    if (notificationsError || recurringError) {
      console.error("trigger checks error:", { notificationsError, recurringError });
      return new Response(JSON.stringify({ success: false, notificationsError, recurringError }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, notifications: notificationsData, recurring: recurringData }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("check-notification-triggers error:", error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
