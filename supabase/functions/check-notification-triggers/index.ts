import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
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
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
