import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const escapeHtml = (value: string = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

type Branding = {
  company_name?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
};

function buildEmailTemplate(params: {
  type: "error" | "warning" | "info";
  title: string;
  message: string;
  link?: string;
  brand?: Branding;
}) {
  const { type, title, message, link, brand } = params;

  const companyName = brand?.company_name || "Harmon Digital";
  const logo = brand?.logo_url || "https://os.harmon-digital.com/logo.png";

  // Small colored dot per type — subtle, not overwhelming
  const dot = {
    error: { color: "#dc2626", label: "Error" },
    warning: { color: "#d97706", label: "Warning" },
    info: { color: "#6b7280", label: "Notification" },
  }[type];

  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");
  const safeLink = link ? escapeHtml(link) : "";
  const ctaHref = safeLink ? `https://os.harmon-digital.com${safeLink}` : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0; padding:0; background:#fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color:#111827; -webkit-font-smoothing:antialiased;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${escapeHtml(message).slice(0, 120)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <!-- Wordmark row -->
          <tr>
            <td style="padding:0 4px 20px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${logo}" alt="" width="20" height="20" style="display:inline-block; vertical-align:middle; border:0; border-radius:4px; margin-right:8px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:13px; font-weight:600; color:#111827; letter-spacing:-0.01em;">${escapeHtml(companyName)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px;">
              <!-- Type label + dot -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:24px 28px 0 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align:middle; padding-right:6px;">
                          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${dot.color};"></span>
                        </td>
                        <td style="vertical-align:middle;">
                          <span style="font-size:11px; font-weight:500; color:#6b7280; letter-spacing:0.02em; text-transform:uppercase;">${dot.label}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:8px 28px 0 28px;">
                    <h1 style="margin:0; font-size:18px; line-height:1.4; font-weight:600; color:#111827; letter-spacing:-0.01em;">${safeTitle}</h1>
                  </td>
                </tr>
              </table>

              <!-- Message -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:10px 28px 24px 28px;">
                    <p style="margin:0; font-size:14px; line-height:1.6; color:#4b5563;">${safeMessage}</p>
                  </td>
                </tr>
              </table>

              ${link ? `
              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0 28px 28px 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:#111827; border-radius:6px;">
                          <a href="${ctaHref}" style="display:inline-block; padding:9px 14px; font-size:13px; font-weight:500; color:#ffffff; text-decoration:none; letter-spacing:-0.005em;">Open</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ""}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 4px 0 4px;">
              <p style="margin:0; font-size:11px; line-height:1.5; color:#9ca3af;">
                <a href="https://os.harmon-digital.com" style="color:#6b7280; text-decoration:none;">os.harmon-digital.com</a>
                <span style="margin:0 6px; color:#d1d5db;">·</span>
                <a href="https://os.harmon-digital.com/PersonalSettings" style="color:#6b7280; text-decoration:none;">Notification preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Shared secret for DB-trigger → function calls. The matching value is
// stored in Supabase Vault under the name 'notify_internal_secret' so the
// pg_net trigger can read it without it leaking to end users. To rotate:
// update both this constant and the vault entry in one change.
const INTERNAL_SHARED_SECRET =
  Deno.env.get("NOTIFY_INTERNAL_SECRET") ?? "hdo-notify-3f9a1c7e4b2d8f6e9a1c3b5d7e9f1a3c";

Deno.serve(async (req) => {
  // Auth: accept either the Supabase service role key (env) or the
  // dedicated internal shared secret. Either one can come in via
  // Authorization: Bearer <token>.
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const accepted = bearerToken && (
    bearerToken === INTERNAL_SHARED_SECRET ||
    (serviceKey && bearerToken === serviceKey)
  );

  if (!accepted) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const record = payload?.record;

    let to: string;
    let subject: string;
    let htmlBody: string;

    if (record) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const [tmResult, brandingResult] = await Promise.all([
        supabase
          .from("team_members")
          .select("email, full_name")
          .eq("user_id", record.user_id)
          .maybeSingle(),
        supabase
          .from("branding_settings")
          .select("company_name, primary_color, secondary_color, accent_color, logo_url")
          .limit(1)
          .maybeSingle(),
      ]);

      if (tmResult.error) throw new Error(`team_members query failed: ${tmResult.error.message}`);
      if (brandingResult.error) throw new Error(`branding_settings query failed: ${brandingResult.error.message}`);

      const teamMember = tmResult.data;
      const branding = brandingResult.data;

      if (!teamMember?.email) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "no email found" }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      to = teamMember.email;
      subject = record.title;

      const type: "error" | "warning" | "info" =
        record.type === "error"
          ? "error"
          : record.type === "warning"
          ? "warning"
          : "info";

      htmlBody = buildEmailTemplate({
        type,
        title: record.title,
        message: record.message,
        link: record.link,
        brand: branding || undefined,
      });
    } else {
      if (!payload.to || !payload.subject) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: to, subject" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      to = payload.to;
      subject = payload.subject;
      if (!to || typeof to !== "string" || !to.includes("@")) {
        return new Response(JSON.stringify({ error: "Valid 'to' email address required" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      if (!subject || typeof subject !== "string") {
        return new Response(JSON.stringify({ error: "'subject' is required" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      const message = payload.message || "";
      htmlBody = buildEmailTemplate({
        type: "info",
        title: subject || "Notification",
        message,
      });
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Plain-text fallback derived from the source data (better for deliverability + a11y)
    const textBody = (() => {
      const lines = [subject];
      if (record?.message) lines.push("", record.message);
      else if (payload.message) lines.push("", payload.message);
      if (record?.link) lines.push("", `Open: https://os.harmon-digital.com${record.link}`);
      lines.push("", "—", "Harmon Digital OS", "https://os.harmon-digital.com");
      return lines.join("\n");
    })();

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
        text: textBody,
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
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
