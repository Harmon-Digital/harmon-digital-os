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

      const accentColor = record.type === "error" ? "#ef4444" : record.type === "warning" ? "#f59e0b" : "#6366f1";
      const accentBg = record.type === "error" ? "#fef2f2" : record.type === "warning" ? "#fffbeb" : "#eef2ff";

      htmlBody = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
            <tr><td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1e1b4b, #312e81); padding: 28px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">Harmon Digital</span>
                          <span style="font-size: 13px; color: #a5b4fc; margin-left: 8px; font-weight: 500;">OS</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Accent bar -->
                <tr><td style="height: 3px; background: ${accentColor};"></td></tr>
                <!-- Body -->
                <tr>
                  <td style="padding: 32px;">
                    <div style="background: ${accentBg}; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
                      <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${accentColor};">${record.type === "error" ? "Error" : record.type === "warning" ? "Warning" : "Notification"}</p>
                      <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 700; color: #1e1b4b; line-height: 1.3;">${record.title}</h2>
                      <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.6;">${record.message}</p>
                    </div>
                    ${record.link ? `
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="background: #4f46e5; border-radius: 8px;">
                          <a href="https://os.harmon-digital.com${record.link}" style="display: inline-block; padding: 12px 28px; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; letter-spacing: 0.2px;">View in Harmon OS →</a>
                        </td>
                      </tr>
                    </table>
                    ` : ""}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 0 32px 28px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                        <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                          <a href="https://os.harmon-digital.com" style="color: #6366f1; text-decoration: none; font-weight: 500;">os.harmon-digital.com</a>
                          <span style="margin: 0 8px;">•</span>
                          <a href="https://harmon-digital.com" style="color: #9ca3af; text-decoration: none;">harmon-digital.com</a>
                        </p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
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
