import { createCrudTools } from "./crud.ts";
import { createKpiTools } from "./kpi.ts";
import { createNotificationTools } from "./notifications.ts";
import { createReportTools } from "./reports.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

// All entities — matching supabaseEntities.js + additional tables
const ENTITIES: Array<[string, string]> = [
  // From supabaseEntities.js
  ["accounts", "Account"],
  ["contacts", "Contact"],
  ["projects", "Project"],
  ["team_members", "Team Member"],
  ["tasks", "Task"],
  ["time_entries", "Time Entry"],
  ["leads", "Lead"],
  ["activities", "Activity"],
  ["payments", "Payment"],
  ["transactions", "Transaction"],
  ["expenses", "Expense"],
  ["invoices", "Invoice"],
  ["stripe_products", "Stripe Product"],
  ["stripe_subscriptions", "Stripe Subscription"],
  ["social_posts", "Social Post"],
  ["sops", "SOP"],
  ["notifications", "Notification"],
  ["branding_settings", "Branding Setting"],
  ["user_profiles", "User Profile"],
  ["kpi_entries", "KPI Entry"],
  // Chat & collaboration
  ["chat_channels", "Chat Channel"],
  ["chat_messages", "Chat Message"],
  ["chat_message_reactions", "Chat Message Reaction"],
  ["chat_message_attachments", "Chat Message Attachment"],
  ["task_attachments", "Task Attachment"],
  ["task_comments", "Task Comment"],
  ["notification_preferences", "Notification Preference"],
  // Additional tables
  ["brokers", "Broker"],
  ["referral_partners", "Referral Partner"],
  ["referrals", "Referral"],
  ["referral_payouts", "Referral Payout"],
  ["broker_activities", "Broker Activity"],
  ["lead_activities", "Lead Activity"],
  ["project_documents", "Project Document"],
  ["mcp_api_keys", "MCP API Key"],
];

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, client: SupabaseClient) => Promise<unknown>;
}

export function getAllTools(): ToolDef[] {
  const tools: ToolDef[] = [];

  // CRUD tools for all entities
  for (const [table, label] of ENTITIES) {
    tools.push(...createCrudTools(table, label));
  }

  // Specialized tools
  tools.push(...createKpiTools());
  tools.push(...createNotificationTools());
  tools.push(...createReportTools());

  return tools;
}
