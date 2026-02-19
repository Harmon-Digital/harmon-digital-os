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
        return { notifications: data, count: data.length };
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
        return { updated: data.length };
      },
    },
  ];
}
