import { createCrudTools } from "./crud.ts";
import { createKpiTools } from "./kpi.ts";
import { createNotificationTools } from "./notifications.ts";
import { createReportTools } from "./reports.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

// All entities — matching supabaseEntities.js + additional tables.
// Optional third element: text columns the `search_*` tool should match.
// Tables without text columns get no search tool registered.
const ENTITIES: Array<[string, string, string[]?]> = [
  // From supabaseEntities.js
  ["accounts", "Account", ["company_name", "email"]],
  ["contacts", "Contact", ["first_name", "last_name", "email"]],
  ["projects", "Project", ["name", "description"]],
  ["team_members", "Team Member", ["full_name", "email"]],
  ["tasks", "Task", ["title", "description"]],
  ["time_entries", "Time Entry", ["description"]],
  ["leads", "Lead", ["company_name", "contact_name", "email"]],
  ["activities", "Activity", ["description"]],
  ["payments", "Payment"],
  ["transactions", "Transaction", ["description"]],
  ["expenses", "Expense", ["description", "vendor"]],
  ["invoices", "Invoice", ["invoice_number"]],
  ["stripe_products", "Stripe Product", ["name", "description"]],
  ["stripe_subscriptions", "Stripe Subscription"],
  ["social_posts", "Social Post", ["title", "caption"]],
  ["sops", "SOP", ["title", "description"]],
  ["notifications", "Notification", ["title", "message"]],
  ["branding_settings", "Branding Setting"],
  ["user_profiles", "User Profile", ["full_name", "email"]],
  ["kpi_entries", "KPI Entry"],
  // Chat & collaboration
  ["chat_channels", "Chat Channel", ["name", "description"]],
  ["chat_messages", "Chat Message", ["content"]],
  ["chat_message_reactions", "Chat Message Reaction"],
  ["chat_message_attachments", "Chat Message Attachment", ["file_name"]],
  ["task_attachments", "Task Attachment", ["file_name"]],
  ["task_comments", "Task Comment", ["content"]],
  ["notification_preferences", "Notification Preference"],
  // Additional tables
  ["brokers", "Broker", ["company_name", "contact_name", "email"]],
  ["referral_partners", "Referral Partner", ["contact_name", "company_name", "email"]],
  ["referrals", "Referral"],
  ["referral_payouts", "Referral Payout"],
  ["broker_activities", "Broker Activity", ["description"]],
  ["lead_activities", "Lead Activity", ["description"]],
  ["project_documents", "Project Document", ["name"]],
  ["mcp_api_keys", "MCP API Key", ["name"]],
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
  for (const [table, label, searchColumns] of ENTITIES) {
    tools.push(...createCrudTools(table, label, searchColumns ?? []));
  }

  // Specialized tools
  tools.push(...createKpiTools());
  tools.push(...createNotificationTools());
  tools.push(...createReportTools());

  return tools;
}
