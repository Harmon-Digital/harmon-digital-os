import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();

    // If called via webhook/trigger, record is the notification row
    // If called directly, expect { to, subject, message }
    let to: string;
    let subject: string;
    let htmlBody: string;

    if (record) {
      // Called from DB webhook — look up team member email
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: teamMember } = await supabase
        .from("team_members")
        .select("email, full_name")
        .eq("user_id", record.user_id)
        .single();

      if (!teamMember?.email) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "no email found" }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      to = teamMember.email;
      subject = record.title;
      const typeEmoji =
        record.type === "error"
          ? "🔴"
          : record.type === "warning"
          ? "⚠️"
          : "ℹ️";

      htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; border-left: 4px solid ${
            record.type === "error"
              ? "#ef4444"
              : record.type === "warning"
              ? "#f59e0b"
              : "#3b82f6"
          };">
            <h2 style="margin: 0 0 8px 0; color: #1f2937;">${typeEmoji} ${record.title}</h2>
            <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 16px;">${record.message}</p>
            ${
              record.link
                ? `<a href="https://os.harmon-digital.com${record.link}" style="display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">View in Harmon OS</a>`
                : ""
            }
          </div>
          <p style="margin-top: 16px; color: #9ca3af; font-size: 12px;">Harmon Digital OS • <a href="https://os.harmon-digital.com" style="color: #9ca3af;">os.harmon-digital.com</a></p>
        </div>
      `;
    } else {
      const body = await req.json().catch(() => ({}));
      to = body.to;
      subject = body.subject;
      htmlBody = `<p>${body.message}</p>`;
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Harmon Digital OS <notifications@notifications.harmon-digital.com>",
        to: [to],
        subject,
        html: htmlBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", data);
      return new Response(JSON.stringify({ error: data }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
