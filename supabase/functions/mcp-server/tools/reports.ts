import type { ToolDef } from "./registry.ts";

export function createReportTools(): ToolDef[] {
  return [
    {
      name: "revenue_summary",
      description: "Get revenue summary — aggregate invoices by status for a date range",
      inputSchema: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
          end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
        },
        required: ["start_date", "end_date"],
      },
      handler: async (args, client) => {
        const { data, error } = await client
          .from("invoices")
          .select("status, total, issue_date")
          .gte("issue_date", args.start_date as string)
          .lte("issue_date", args.end_date as string);
        if (error) throw error;

        const summary: Record<string, { count: number; total: number }> = {};
        let grandTotal = 0;

        for (const inv of data) {
          const status = inv.status || "unknown";
          if (!summary[status]) summary[status] = { count: 0, total: 0 };
          summary[status].count++;
          summary[status].total += Number(inv.total) || 0;
          grandTotal += Number(inv.total) || 0;
        }

        return { period: { start: args.start_date, end: args.end_date }, by_status: summary, grand_total: grandTotal, invoice_count: data.length };
      },
    },

    {
      name: "pipeline_summary",
      description: "Get lead pipeline summary — count and estimated value by status",
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

        for (const lead of data) {
          const status = lead.status || "unknown";
          if (!byStatus[status]) byStatus[status] = { count: 0, value: 0 };
          byStatus[status].count++;
          const val = Number(lead.estimated_value) || 0;
          byStatus[status].value += val;
          totalValue += val;
        }

        return { by_status: byStatus, total_leads: data.length, total_estimated_value: totalValue };
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

        const { data: members, error: tmError } = await client
          .from("team_members")
          .select("id, full_name, role")
          .eq("status", "active");
        if (tmError) throw tmError;

        const memberMap = new Map(members.map((m: Record<string, unknown>) => [m.id, m]));

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
              weekly_capacity: (member?.weekly_capacity as number) || 40,
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
      description: "Get project hours summary — time tracked per project vs budget",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Optional single project UUID" },
          status: { type: "string", description: "Filter projects by status (e.g. active)" },
        },
      },
      handler: async (args, client) => {
        // Get projects
        let pQuery = client.from("projects").select("id, name, status, budget_hours");
        if (args.project_id) pQuery = pQuery.eq("id", args.project_id as string);
        if (args.status) pQuery = pQuery.eq("status", args.status as string);

        const { data: projects, error: pError } = await pQuery;
        if (pError) throw pError;

        const projectIds = projects.map((p: Record<string, unknown>) => p.id as string);
        if (projectIds.length === 0) return { projects: [] };

        // Get time entries for those projects
        const { data: entries, error: teError } = await client
          .from("time_entries")
          .select("project_id, hours, billable")
          .in("project_id", projectIds);
        if (teError) throw teError;

        // Aggregate
        const hoursMap: Record<string, { total: number; billable: number }> = {};
        for (const entry of entries) {
          const pid = entry.project_id as string;
          if (!hoursMap[pid]) hoursMap[pid] = { total: 0, billable: 0 };
          hoursMap[pid].total += Number(entry.hours) || 0;
          if (entry.billable) hoursMap[pid].billable += Number(entry.hours) || 0;
        }

        return {
          projects: projects.map((p: Record<string, unknown>) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            budget_hours: p.budget_hours,
            hours_tracked: hoursMap[p.id as string]?.total || 0,
            billable_hours: hoursMap[p.id as string]?.billable || 0,
            remaining: (p.budget_hours as number) ? (p.budget_hours as number) - (hoursMap[p.id as string]?.total || 0) : null,
          })),
        };
      },
    },
  ];
}
