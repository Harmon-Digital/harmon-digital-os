export interface PromptDef {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  template: (args: Record<string, string>) => string;
}

export function getAllPrompts(): PromptDef[] {
  return [
    {
      name: "weekly_standup",
      description: "Generate a weekly standup report for a team member — tasks completed, hours logged, upcoming due dates",
      arguments: [
        { name: "team_member_id", description: "Team member UUID", required: true },
        { name: "week_start", description: "Monday date (YYYY-MM-DD)", required: true },
      ],
      template: (args) =>
        `Generate a weekly standup report for team member ${args.team_member_id} for the week starting ${args.week_start}. Use these tools:
1. Call filter_tasks with filters {"assigned_to": "${args.team_member_id}", "status": "completed"} to get completed tasks
2. Call filter_time_entries with filters {"team_member_id": "${args.team_member_id}"} and check dates within the week
3. Call filter_tasks with filters {"assigned_to": "${args.team_member_id}", "status": "in_progress"} to get upcoming work
4. Call calculate_all_kpis with period_start="${args.week_start}" and team_member_id="${args.team_member_id}"

Format as a standup with sections: Completed, Hours Summary, In Progress / Upcoming, KPI Highlights.`,
    },

    {
      name: "client_briefing",
      description: "Generate a client briefing — projects, tasks, invoices, and pipeline status for an account",
      arguments: [
        { name: "account_id", description: "Account UUID", required: true },
      ],
      template: (args) =>
        `Generate a client briefing for account ${args.account_id}. Use these tools:
1. Call get_accounts with id="${args.account_id}" to get account details
2. Call filter_projects with filters {"account_id": "${args.account_id}"} to get all projects
3. Call filter_tasks with filters {"account_id": "${args.account_id}"} to get tasks (or filter by each project)
4. Call filter_invoices with filters {"account_id": "${args.account_id}"} to see billing history
5. Call filter_leads with filters {"account_id": "${args.account_id}"} if relevant

Format as a briefing with sections: Account Overview, Active Projects, Task Status, Billing Summary, Notes/Next Steps.`,
    },

    {
      name: "kpi_review",
      description: "Generate a KPI performance review for a period",
      arguments: [
        { name: "start_period", description: "Start date (YYYY-MM-DD)", required: true },
        { name: "end_period", description: "End date (YYYY-MM-DD)", required: true },
        { name: "team_member_id", description: "Optional team member UUID", required: false },
      ],
      template: (args) => {
        const memberClause = args.team_member_id
          ? ` and team_member_id="${args.team_member_id}"`
          : "";
        return `Generate a KPI performance review for ${args.start_period} to ${args.end_period}. Use these tools:
1. Call get_kpi_report with start_period="${args.start_period}" and end_period="${args.end_period}"${memberClause}
2. Call list_kpi_definitions to understand what each KPI measures
3. Call revenue_summary with start_date="${args.start_period}" and end_date="${args.end_period}"
4. Call team_utilization with start_date="${args.start_period}" and end_date="${args.end_period}"

Format as a performance review with sections: KPI Dashboard (table of metrics with values), Revenue Highlights, Utilization, Trends & Insights.`;
      },
    },
  ];
}
