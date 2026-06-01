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
        },
        required: ["user_id", "type", "title", "message"],
      },
      handler: async (args, client) => {
        const { data, error } = await client
          .from("notifications")
          .insert({
            user_id: args.user_id,
            type: args.type,
            title: args.title,
            message: args.message,
            link: args.link || null,
            read: false,
            // Match the in-app helper in src/api/functions.js so MCP-issued
            // notifications go through the same email-routing pipeline.
            category: (args.category as string) || "general",
            priority: (args.priority as string) || "normal",
            email_enabled: args.email_enabled !== undefined ? !!args.email_enabled : true,
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
        const limit = (args.limit as number) || 20;
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
