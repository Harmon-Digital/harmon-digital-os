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
  const primary = brand?.primary_color || "#4F46E5";
  const secondary = brand?.secondary_color || "#3B82F6";
  const accent = brand?.accent_color || "#10B981";
  const logo = brand?.logo_url || "https://os.harmon-digital.com/logo.png";

  const palette = {
    error: {
      label: "Error",
      color: "#DC2626",
      softBg: "#FEF2F2",
      border: "#FCA5A5",
      icon: "🔴",
    },
    warning: {
      label: "Warning",
      color: "#D97706",
      softBg: "#FFFBEB",
      border: "#FCD34D",
      icon: "⚠️",
    },
    info: {
      label: "Notification",
      color: primary,
      softBg: "#EEF2FF",
      border: "#C7D2FE",
      icon: "ℹ️",
    },
  }[type];

  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");
  const ctaHref = link ? `https://os.harmon-digital.com${link}` : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0; padding:0; background:#F8FAFC; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px; background:#FFFFFF; border:1px solid #E5E7EB; border-radius:14px; overflow:hidden;">
          <tr>
            <td style="background:#000000; padding:18px 24px; border-bottom:3px solid ${primary};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${logo}" alt="${escapeHtml(companyName)}" width="24" height="24" style="display:inline-block; vertical-align:middle; border:0; border-radius:4px; margin-right:8px;" />
                    <span style="font-size:16px; font-weight:700; color:#FFFFFF; vertical-align:middle;">${escapeHtml(companyName)} OS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${palette.softBg}; border:1px solid ${palette.border}; border-radius:12px;">
                <tr>
                  <td style="padding:18px 18px 16px 18px;">
                    <p style="margin:0 0 8px 0; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; font-weight:700; color:${palette.color};">${palette.icon} ${palette.label}</p>
                    <h1 style="margin:0 0 10px 0; font-size:22px; line-height:1.25; color:#111827;">${safeTitle}</h1>
                    <p style="margin:0; font-size:15px; line-height:1.65; color:#374151;">${safeMessage}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${link ? `
          <tr>
            <td style="padding:0 24px 24px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${primary}; border-radius:10px;">
                    <a href="${ctaHref}" style="display:inline-block; padding:12px 18px; font-size:14px; font-weight:600; color:#FFFFFF; text-decoration:none;">Open in Harmon OS →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <tr>
            <td style="padding:18px 24px 24px 24px; border-top:1px solid #E5E7EB;">
              <p style="margin:0; text-align:center; font-size:12px; line-height:1.5; color:#6B7280;">
                <a href="https://os.harmon-digital.com" style="color:${secondary}; text-decoration:none; font-weight:600;">os.harmon-digital.com</a>
                <span style="margin:0 8px; color:#9CA3AF;">•</span>
                <a href="https://harmon-digital.com" style="color:#6B7280; text-decoration:none;">harmon-digital.com</a>
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

Deno.serve(async (req) => {
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

      const [{ data: teamMember }, { data: branding }] = await Promise.all([
        supabase
          .from("team_members")
          .select("email, full_name")
          .eq("user_id", record.user_id)
          .single(),
        supabase
          .from("branding_settings")
          .select("company_name, primary_color, secondary_color, accent_color, logo_url")
          .limit(1)
          .maybeSingle(),
      ]);

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
      to = payload.to;
      subject = payload.subject;
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
