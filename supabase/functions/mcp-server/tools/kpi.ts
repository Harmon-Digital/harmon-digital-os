import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolDef } from "./registry.ts";

// KPI definitions — duplicated from src/config/kpiConfig.js (minus React icons)
export const KPI_DEFINITIONS = [
  {
    slug: "revenue_paid",
    name: "Revenue (Paid)",
    category: "revenue",
    unit: "currency",
    calcType: "auto",
    hero: true,
    source: { table: "invoices", filter: { status: "paid" }, aggregate: "sum", field: "total", dateField: "issue_date" },
    perMember: false,
  },
  {
    slug: "revenue_invoiced",
    name: "Revenue (Invoiced)",
    category: "revenue",
    unit: "currency",
    calcType: "auto",
    source: { table: "invoices", filter: {}, aggregate: "sum", field: "total", dateField: "issue_date" },
    perMember: false,
  },
  {
    slug: "new_leads",
    name: "New Leads",
    category: "leads",
    unit: "number",
    calcType: "auto",
    hero: true,
    source: { table: "leads", filter: {}, aggregate: "count", dateField: "created_at" },
    perMember: true,
    memberField: "assigned_to",
  },
  {
    slug: "won_deals",
    name: "Won Deals",
    category: "leads",
    unit: "number",
    calcType: "auto",
    hero: true,
    source: { table: "leads", filter: { status: "won" }, aggregate: "count", dateField: "updated_at" },
    perMember: true,
    memberField: "assigned_to",
  },
  {
    slug: "brokers_contacted",
    name: "Broker Outreach",
    category: "leads",
    unit: "number",
    calcType: "auto",
    source: { table: "broker_activities", filter: {}, aggregate: "count", dateField: "created_at" },
    perMember: true,
    memberField: "team_member_id",
  },
  {
    slug: "social_posts",
    name: "Social Posts",
    category: "social",
    unit: "number",
    calcType: "auto",
    hero: true,
    source: { table: "social_posts", filter: { status: "published" }, aggregate: "count", dateField: "scheduled_date" },
    perMember: true,
    memberField: "assigned_to",
  },
  {
    slug: "ig_followers",
    name: "Instagram Followers",
    category: "social",
    unit: "number",
    calcType: "manual",
    perMember: false,
  },
  {
    slug: "li_followers",
    name: "LinkedIn Followers",
    category: "social",
    unit: "number",
    calcType: "manual",
    perMember: false,
  },
  {
    slug: "hours_worked",
    name: "Hours Worked",
    category: "operations",
    unit: "hours",
    calcType: "auto",
    hero: true,
    source: { table: "time_entries", filter: {}, aggregate: "sum", field: "hours", dateField: "date" },
    perMember: true,
    memberField: "team_member_id",
  },
  {
    slug: "billable_hours",
    name: "Billable Hours",
    category: "operations",
    unit: "hours",
    calcType: "auto",
    source: { table: "time_entries", filter: { billable: true }, aggregate: "sum", field: "hours", dateField: "date" },
    perMember: true,
    memberField: "team_member_id",
  },
  {
    slug: "tasks_completed",
    name: "Tasks Completed",
    category: "operations",
    unit: "number",
    calcType: "auto",
    source: { table: "tasks", filter: { status: "completed" }, aggregate: "count", dateField: "updated_at" },
    perMember: true,
    memberField: "assigned_to",
  },
  {
    slug: "active_projects",
    name: "Active Projects",
    category: "operations",
    unit: "number",
    calcType: "auto",
    source: { table: "projects", filter: { status: "active" }, aggregate: "count", dateField: null },
    perMember: false,
  },
] as const;

type KpiDef = (typeof KPI_DEFINITIONS)[number];

async function calculateKpiValue(
  client: SupabaseClient,
  kpiDef: KpiDef,
  periodStart: string,
  teamMemberId: string | null
): Promise<number | null> {
  if (kpiDef.calcType !== "auto" || !("source" in kpiDef) || !kpiDef.source) return null;

  const { table, filter, aggregate, field, dateField } = kpiDef.source;

  const start = new Date(periodStart + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const periodEnd = end.toISOString().split("T")[0];

  let query = client.from(table).select(field || "*");

  if (filter) {
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
  }

  if (teamMemberId && kpiDef.perMember && "memberField" in kpiDef && kpiDef.memberField) {
    query = query.eq(kpiDef.memberField, teamMemberId);
  }

  if (dateField) {
    query = query.gte(dateField, periodStart).lt(dateField, periodEnd);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (aggregate === "count") return data.length;
  if (aggregate === "sum" && field) {
    return data.reduce((sum: number, row: Record<string, unknown>) => sum + (Number(row[field]) || 0), 0);
  }
  return data.length;
}

export function createKpiTools(): ToolDef[] {
  return [
    {
      name: "calculate_kpi",
      description: "Calculate a single KPI value for a weekly period. Period start should be a Monday (YYYY-MM-DD).",
      inputSchema: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description: "KPI slug (e.g. hours_worked, revenue_paid, new_leads)",
            enum: KPI_DEFINITIONS.filter((k) => k.calcType === "auto").map((k) => k.slug),
          },
          period_start: { type: "string", description: "Week start date (Monday) in YYYY-MM-DD format" },
          team_member_id: { type: "string", description: "Optional team member UUID for per-member KPIs" },
        },
        required: ["slug", "period_start"],
      },
      handler: async (args, client) => {
        const def = KPI_DEFINITIONS.find((k) => k.slug === args.slug);
        if (!def) throw new Error(`Unknown KPI slug: ${args.slug}`);
        const value = await calculateKpiValue(
          client,
          def,
          args.period_start as string,
          (args.team_member_id as string) || null
        );
        return { slug: def.slug, name: def.name, value, unit: def.unit, period_start: args.period_start };
      },
    },

    {
      name: "calculate_all_kpis",
      description: "Calculate all auto-calculated KPIs for a weekly period",
      inputSchema: {
        type: "object",
        properties: {
          period_start: { type: "string", description: "Week start date (Monday) in YYYY-MM-DD format" },
          team_member_id: { type: "string", description: "Optional team member UUID (only per-member KPIs will be included)" },
        },
        required: ["period_start"],
      },
      handler: async (args, client) => {
        const teamMemberId = (args.team_member_id as string) || null;
        let autoKpis = KPI_DEFINITIONS.filter((k) => k.calcType === "auto");
        if (teamMemberId) {
          autoKpis = autoKpis.filter((k) => k.perMember);
        }

        const results: Record<string, unknown> = {};
        await Promise.all(
          autoKpis.map(async (kpi) => {
            try {
              results[kpi.slug] = {
                name: kpi.name,
                value: await calculateKpiValue(client, kpi, args.period_start as string, teamMemberId),
                unit: kpi.unit,
              };
            } catch (err) {
              results[kpi.slug] = { name: kpi.name, value: null, error: (err as Error).message };
            }
          })
        );
        return { period_start: args.period_start, team_member_id: teamMemberId, results };
      },
    },

    {
      name: "save_kpi_entries",
      description: "Save (upsert) KPI entries. Matches on slug + month + team_member_id.",
      inputSchema: {
        type: "object",
        properties: {
          entries: {
            type: "array",
            description: "Array of KPI entry objects",
            items: {
              type: "object",
              properties: {
                slug: { type: "string" },
                month: { type: "string", description: "Period date (YYYY-MM-DD)" },
                actual_value: { type: "number" },
                target_value: { type: "number" },
                bonus_amount: { type: "number" },
                notes: { type: "string" },
                team_member_id: { type: "string" },
              },
              required: ["slug", "month", "actual_value"],
            },
          },
        },
        required: ["entries"],
      },
      handler: async (args, client) => {
        const entries = args.entries as Array<Record<string, unknown>>;
        const results = [];

        for (const entry of entries) {
          const teamMemberId = (entry.team_member_id as string) || null;

          let matchQuery = client
            .from("kpi_entries")
            .select("id")
            .eq("slug", entry.slug as string)
            .eq("month", entry.month as string);

          if (teamMemberId) {
            matchQuery = matchQuery.eq("team_member_id", teamMemberId);
          } else {
            matchQuery = matchQuery.is("team_member_id", null);
          }

          const { data: existing } = await matchQuery.maybeSingle();

          if (existing) {
            const updates: Record<string, unknown> = { actual_value: entry.actual_value };
            if (entry.target_value !== undefined) updates.target_value = entry.target_value;
            if (entry.bonus_amount !== undefined) updates.bonus_amount = entry.bonus_amount;
            if (entry.notes !== undefined) updates.notes = entry.notes;

            const { data, error } = await client
              .from("kpi_entries")
              .update(updates)
              .eq("id", existing.id)
              .select()
              .single();
            if (error) throw error;
            results.push(data);
          } else {
            const { data, error } = await client
              .from("kpi_entries")
              .insert({
                slug: entry.slug,
                month: entry.month,
                actual_value: entry.actual_value ?? 0,
                target_value: entry.target_value ?? null,
                bonus_amount: entry.bonus_amount ?? null,
                notes: entry.notes ?? null,
                team_member_id: teamMemberId,
              })
              .select()
              .single();
            if (error) throw error;
            results.push(data);
          }
        }

        return { saved: results.length, entries: results };
      },
    },

    {
      name: "get_kpi_report",
      description: "Fetch KPI entries for a date range, optionally filtered by team member",
      inputSchema: {
        type: "object",
        properties: {
          start_period: { type: "string", description: "Start date (YYYY-MM-DD)" },
          end_period: { type: "string", description: "End date (YYYY-MM-DD)" },
          team_member_id: { type: "string", description: "Optional team member UUID" },
        },
        required: ["start_period", "end_period"],
      },
      handler: async (args, client) => {
        const teamMemberId = (args.team_member_id as string) || null;

        let query = client
          .from("kpi_entries")
          .select("*")
          .gte("month", args.start_period as string)
          .lte("month", args.end_period as string)
          .order("month", { ascending: true });

        if (teamMemberId) {
          query = query.eq("team_member_id", teamMemberId);
        } else {
          query = query.is("team_member_id", null);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { entries: data, definitions: KPI_DEFINITIONS.map((k) => ({ slug: k.slug, name: k.name, unit: k.unit, category: k.category })) };
      },
    },

    {
      name: "list_kpi_definitions",
      description: "List all KPI definitions with their slugs, categories, and calculation types",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        return KPI_DEFINITIONS.map((k) => ({
          slug: k.slug,
          name: k.name,
          category: k.category,
          unit: k.unit,
          calcType: k.calcType,
          perMember: k.perMember,
        }));
      },
    },
  ];
}
