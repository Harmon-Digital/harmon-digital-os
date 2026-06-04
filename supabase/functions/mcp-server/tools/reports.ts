import type { ToolDef } from "./registry.ts";

export function createReportTools(): ToolDef[] {
  return [
    {
      name: "revenue_summary",
      description: "Get revenue summary — aggregate invoices by status for a date range. Paid invoices are bucketed by paid_at; everything else by issue_date (matches in-app Revenue KPIs).",
      inputSchema: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
          end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
        },
        required: ["start_date", "end_date"],
      },
      handler: async (args, client) => {
        const start = args.start_date as string;
        const end = args.end_date as string;

        // paid_at is TIMESTAMPTZ; ".lte(end)" against a YYYY-MM-DD string compares
        // against midnight UTC, silently excluding anything paid on `end` after 00:00.
        // Use an exclusive next-day boundary to match the `revenue_paid` KPI window.
        const endDate = new Date(`${end}T00:00:00Z`);
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        const endExclusive = endDate.toISOString().slice(0, 10);

        // Paid invoices: bucket by paid_at so the answer matches `revenue_paid` KPI.
        const { data: paidRows, error: paidErr } = await client
          .from("invoices")
          .select("status, total, paid_at")
          .eq("status", "paid")
          .gte("paid_at", start)
          .lt("paid_at", endExclusive);
        if (paidErr) throw paidErr;

        // Non-paid invoices: bucket by issue_date (DATE column — inclusive is fine).
        const { data: otherRows, error: otherErr } = await client
          .from("invoices")
          .select("status, total, issue_date")
          .neq("status", "paid")
          .gte("issue_date", start)
          .lte("issue_date", end);
        if (otherErr) throw otherErr;

        const summary: Record<string, { count: number; total: number }> = {};
        let grandTotal = 0;
        const all = [...(paidRows ?? []), ...(otherRows ?? [])];
        for (const inv of all) {
          const status = (inv as { status?: string }).status || "unknown";
          if (!summary[status]) summary[status] = { count: 0, total: 0 };
          summary[status].count++;
          const t = Number((inv as { total?: number | string }).total) || 0;
          summary[status].total += t;
          grandTotal += t;
        }

        return {
          period: { start, end },
          by_status: summary,
          grand_total: grandTotal,
          invoice_count: all.length,
          bucketing: { paid: "paid_at", other: "issue_date" },
        };
      },
    },

    {
      name: "pipeline_summary",
      description: "Get lead pipeline summary — count and estimated value by status. `active_pipeline_value` excludes won/lost (matches the in-app pipeline view); `total_estimated_value_all_statuses` includes them.",
      inputSchema: {
        type: "object",
        properties: {
          assigned_to: { type: "string", description: "Optional team member UUID to filter by" },
        },
      },
      handler: async (args, client) => {
        let query = client.from("leads").select("status, estimated_value");
        if (args.assigned_to) {
          query = query.eq("assigned_to", args.assigned_to as string);
        }

        const { data, error } = await query;
        if (error) throw error;

        const byStatus: Record<string, { count: number; value: number }> = {};
        let totalValue = 0;
        let activeValue = 0;

        for (const lead of data) {
          const status = lead.status || "unknown";
          if (!byStatus[status]) byStatus[status] = { count: 0, value: 0 };
          byStatus[status].count++;
          const val = Number(lead.estimated_value) || 0;
          byStatus[status].value += val;
          totalValue += val;
          if (status !== "won" && status !== "lost") activeValue += val;
        }

        return {
          by_status: byStatus,
          total_leads: data.length,
          active_pipeline_value: activeValue,
          total_estimated_value_all_statuses: totalValue,
          // Back-compat alias — same as the all-statuses figure.
          total_estimated_value: totalValue,
        };
      },
    },

    {
      name: "team_utilization",
      description: "Get team utilization — hours worked per team member for a date range",
      inputSchema: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
          end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
        },
        required: ["start_date", "end_date"],
      },
      handler: async (args, client) => {
        const { data: entries, error: teError } = await client
          .from("time_entries")
          .select("team_member_id, hours, billable, date")
          .gte("date", args.start_date as string)
          .lte("date", args.end_date as string);
        if (teError) throw teError;

        // Fetch all team_members that appear in the entries, regardless of status —
        // an inactive member's hours should still surface with their real name,
        // not "Unknown".
        const memberIds = Array.from(new Set(
          (entries ?? [])
            .map((e: Record<string, unknown>) => e.team_member_id as string | null)
            .filter((id): id is string => !!id),
        ));
        const { data: members, error: tmError } = memberIds.length
          ? await client.from("team_members").select("id, full_name, role").in("id", memberIds)
          : { data: [], error: null };
        if (tmError) throw tmError;

        const memberMap = new Map(members.map((m: Record<string, unknown>) => [m.id, m]));

        // team_members does not have a per-member capacity column today, so we
        // assume a standard 40-hour week. If/when a capacity column is added,
        // include it in the select above and replace this constant.
        const DEFAULT_WEEKLY_CAPACITY = 40;

        const utilization: Record<string, { name: string; role: string; total_hours: number; billable_hours: number; weekly_capacity: number }> = {};

        for (const entry of entries) {
          const mid = entry.team_member_id as string;
          if (!utilization[mid]) {
            const member = memberMap.get(mid) as Record<string, unknown> | undefined;
            utilization[mid] = {
              name: (member?.full_name as string) || "Unknown",
              role: (member?.role as string) || "",
              total_hours: 0,
              billable_hours: 0,
              weekly_capacity: DEFAULT_WEEKLY_CAPACITY,
            };
          }
          utilization[mid].total_hours += Number(entry.hours) || 0;
          if (entry.billable) {
            utilization[mid].billable_hours += Number(entry.hours) || 0;
          }
        }

        return {
          period: { start: args.start_date, end: args.end_date },
          members: Object.entries(utilization).map(([id, data]) => ({ id, ...data })),
        };
      },
    },

    {
      name: "project_hours_summary",
      description: "Get project hours summary — time tracked per project vs budget. For retainer projects, `budget_hours` is a monthly cap and hours_tracked is bucketed to the current calendar month; for fixed-fee/hourly it's lifetime.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Optional single project UUID" },
          status: { type: "string", description: "Filter projects by status (e.g. active)" },
        },
      },
      handler: async (args, client) => {
        // Get projects
        let pQuery = client.from("projects").select("id, name, status, budget_hours, billing_type");
        if (args.project_id) pQuery = pQuery.eq("id", args.project_id as string);
        if (args.status) pQuery = pQuery.eq("status", args.status as string);

        const { data: projects, error: pError } = await pQuery;
        if (pError) throw pError;

        const projectIds = projects.map((p: Record<string, unknown>) => p.id as string);
        if (projectIds.length === 0) return { projects: [] };

        // Get time entries for those projects
        const { data: entries, error: teError } = await client
          .from("time_entries")
          .select("project_id, hours, billable, date")
          .in("project_id", projectIds);
        if (teError) throw teError;

        // Current-month boundaries (UTC) for retainer scoping. The frontend's
        // ProjectDetail bucket uses the local-tz "now", which is close enough for
        // the cadence semantics; UTC is the safer default for a service tool.
        const now = new Date();
        const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
        // last day of this month via day-0 of next month
        const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
        const monthEnd = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        // Aggregate — track lifetime AND monthly so retainer rows can report the
        // window the budget actually covers.
        const lifetimeMap: Record<string, { total: number; billable: number }> = {};
        const monthlyMap: Record<string, { total: number; billable: number }> = {};
        for (const entry of entries) {
          const pid = entry.project_id as string;
          const hrs = Number(entry.hours) || 0;
          if (!lifetimeMap[pid]) lifetimeMap[pid] = { total: 0, billable: 0 };
          lifetimeMap[pid].total += hrs;
          if (entry.billable) lifetimeMap[pid].billable += hrs;
          const d = String(entry.date ?? "");
          if (d >= monthStart && d <= monthEnd) {
            if (!monthlyMap[pid]) monthlyMap[pid] = { total: 0, billable: 0 };
            monthlyMap[pid].total += hrs;
            if (entry.billable) monthlyMap[pid].billable += hrs;
          }
        }

        return {
          projects: projects.map((p: Record<string, unknown>) => {
            const pid = p.id as string;
            const isRetainer = (p.billing_type as string) === "retainer";
            const tracked = isRetainer
              ? (monthlyMap[pid]?.total || 0)
              : (lifetimeMap[pid]?.total || 0);
            const billable = isRetainer
              ? (monthlyMap[pid]?.billable || 0)
              : (lifetimeMap[pid]?.billable || 0);
            const budget = p.budget_hours != null ? Number(p.budget_hours) || 0 : null;
            return {
              id: p.id,
              name: p.name,
              status: p.status,
              billing_type: p.billing_type,
              budget_hours: p.budget_hours,
              budget_window: isRetainer ? { start: monthStart, end: monthEnd } : "lifetime",
              hours_tracked: tracked,
              billable_hours: billable,
              remaining: budget != null ? budget - tracked : null,
            };
          }),
        };
      },
    },
  ];
}
