import type { ToolDef } from "./registry.ts";

export function createNotificationTools(): ToolDef[] {
  return [
    {
      name: "send_notification",
      description: "Send a notification to a user (triggers email via DB webhook)",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "Target user UUID" },
          type: { type: "string", enum: ["info", "warning", "error"], description: "Notification type" },
          title: { type: "string", description: "Notification title" },
          message: { type: "string", description: "Notification body text" },
          link: { type: "string", description: "Optional in-app link path (e.g. /tasks/123)" },
          category: {
            type: "string",
            description: "Routing category — used by notification_preferences to mute classes of email. Defaults to 'general'.",
          },
          priority: {
            type: "string",
            enum: ["low", "normal", "high"],
            description: "Priority. Defaults to 'normal'.",
          },
          email_enabled: {
            type: "boolean",
            description: "If false, suppress the email trigger for this notification (in-app only). Defaults to true.",
          },
          source: {
            type: "string",
            description: "Tag for triage / notification routing (e.g. 'tasks.assignment', 'billing.invoice'). Stored on the row for filtering and analytics.",
          },
          metadata: {
            type: "object",
            description: "Free-form structured context (entity ids, urls, anything the email template should render). Persisted on the notification row.",
            additionalProperties: true,
          },
        },
        required: ["user_id", "type", "title", "message"],
      },
      handler: async (args, client) => {
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const userId = String(args.user_id ?? "");
        if (!UUID_RE.test(userId)) {
          throw new Error("Invalid user_id (must be a UUID)");
        }
        // Verify the target user actually exists so a caller can't fabricate
        // notifications addressed to arbitrary UUIDs (and trigger the email
        // pipeline against them).
        const { data: targetExists, error: lookupErr } = await client
          .from("user_profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();
        if (lookupErr) throw new Error("Failed to verify target user");
        if (!targetExists) throw new Error("Target user_id not found");

        const type = String(args.type ?? "");
        if (!["info", "warning", "error"].includes(type)) {
          throw new Error("Invalid type (must be info/warning/error)");
        }

        // Reject suspicious link schemes. Same-origin paths are fine; if a
        // full URL is supplied, only http(s) is allowed.
        const rawLink = (args.link == null ? "" : String(args.link)).trim();
        let link: string | null = null;
        if (rawLink) {
          if (rawLink.startsWith("/")) {
            link = rawLink.slice(0, 500);
          } else {
            try {
              const parsed = new URL(rawLink);
              if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                throw new Error("Disallowed link protocol");
              }
              link = parsed.toString().slice(0, 500);
            } catch {
              throw new Error("Invalid link URL");
            }
          }
        }

        const title = String(args.title ?? "").slice(0, 200);
        const message = String(args.message ?? "").slice(0, 2000);
        if (!title || !message) throw new Error("title and message are required");

        // Carry source/metadata through to match src/api/functions.js so
        // MCP-issued notifications are indistinguishable from in-app ones
        // for triage UI, email templates, and routing.
        const source = args.source != null ? String(args.source).slice(0, 100) : null;
        const metadata = (args.metadata && typeof args.metadata === "object")
          ? args.metadata as Record<string, unknown>
          : null;

        const { data, error } = await client
          .from("notifications")
          .insert({
            user_id: userId,
            type,
            title,
            message,
            link,
            read: false,
            // Match the in-app helper in src/api/functions.js so MCP-issued
            // notifications go through the same email-routing pipeline.
            category: (args.category as string) || "general",
            priority: (args.priority as string) || "normal",
            email_enabled: args.email_enabled !== undefined ? !!args.email_enabled : true,
            ...(source ? { source } : {}),
            ...(metadata ? { metadata } : {}),
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      },
    },

    {
      name: "list_unread_notifications",
      description: "List unread notifications for a user",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "User UUID" },
          limit: { type: "number", description: "Max results (default: 20)" },
        },
        required: ["user_id"],
      },
      handler: async (args, client) => {
        // Cap limit to match the broader CRUD/search pattern in crud.ts —
        // without a ceiling, a caller could request millions of rows.
        const limit = Math.min(Math.max((args.limit as number) || 20, 1), 100);
        const { data, error } = await client
          .from("notifications")
          .select("*")
          .eq("user_id", args.user_id as string)
          .eq("read", false)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return { notifications: data ?? [], count: data?.length ?? 0 };
      },
    },

    {
      name: "mark_notification_read",
      description: "Mark a notification as read",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Notification UUID" },
        },
        required: ["id"],
      },
      handler: async (args, client) => {
        const { data, error } = await client
          .from("notifications")
          .update({ read: true })
          .eq("id", args.id as string)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
    },

    {
      name: "mark_all_notifications_read",
      description: "Mark all notifications as read for a user",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "User UUID" },
        },
        required: ["user_id"],
      },
      handler: async (args, client) => {
        const { data, error } = await client
          .from("notifications")
          .update({ read: true })
          .eq("user_id", args.user_id as string)
          .eq("read", false)
          .select();
        if (error) throw error;
        return { updated: data?.length ?? 0 };
      },
    },
  ];
}
