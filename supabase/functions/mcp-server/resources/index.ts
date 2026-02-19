import type { SupabaseClient } from "@supabase/supabase-js";
import { KPI_DEFINITIONS } from "../tools/kpi.ts";

export interface ResourceDef {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  handler: (client: SupabaseClient) => Promise<string>;
}

export function getAllResources(): ResourceDef[] {
  return [
    {
      uri: "schema://tables",
      name: "Database Tables",
      description: "List of all tables with their columns and types",
      mimeType: "application/json",
      handler: async (client) => {
        // Try querying information_schema via a raw SQL RPC if available
        const { data: tables, error: tErr } = await client
          .from("information_schema.columns" as string)
          .select("table_name, column_name, data_type, is_nullable")
          .eq("table_schema", "public")
          .order("table_name")
          .order("ordinal_position");

        // Fallback: return a static list if information_schema isn't queryable via PostgREST
        if (tErr) {
          const knownTables = [
            "accounts", "contacts", "projects", "team_members", "tasks",
            "time_entries", "leads", "activities", "payments", "transactions",
            "expenses", "invoices", "stripe_products", "stripe_subscriptions",
            "social_posts", "sops", "notifications", "branding_settings",
            "user_profiles", "kpi_entries", "brokers", "referral_partners",
            "referrals", "referral_payouts", "broker_activities", "lead_activities",
            "project_documents",
          ];
          return JSON.stringify({ tables: knownTables, note: "Column details unavailable via PostgREST" });
        }

        // Group by table
        const schema: Record<string, Array<{ column: string; type: string; nullable: boolean }>> = {};
        for (const row of tables || []) {
          const tn = row.table_name as string;
          if (!schema[tn]) schema[tn] = [];
          schema[tn].push({
            column: row.column_name as string,
            type: row.data_type as string,
            nullable: row.is_nullable === "YES",
          });
        }
        return JSON.stringify(schema);
      },
    },

    {
      uri: "config://kpi-definitions",
      name: "KPI Definitions",
      description: "All KPI slugs, categories, units, and calculation sources",
      mimeType: "application/json",
      handler: async () => {
        return JSON.stringify(
          KPI_DEFINITIONS.map((k) => ({
            slug: k.slug,
            name: k.name,
            category: k.category,
            unit: k.unit,
            calcType: k.calcType,
            perMember: k.perMember,
            ...("source" in k && k.source ? { source: k.source } : {}),
            ...("memberField" in k ? { memberField: k.memberField } : {}),
          }))
        );
      },
    },
  ];
}
