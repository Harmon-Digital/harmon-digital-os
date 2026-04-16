import React from "react";
import { Clock } from "lucide-react";

export default function ProjectAccountingView({
  projectId,
  timeEntries = [],
  teamMembers = [],
  project
}) {
  const projectRate = project?.hourly_rate || 0;
  const isRetainer = project?.billing_type === 'retainer' || project?.billing_type === 'exit';

  // Calculate totals
  const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const billableHours = timeEntries.filter(e => e.billable).reduce((sum, entry) => sum + (entry.hours || 0), 0);

  // Revenue calculation (only for hourly projects)
  const hourlyRevenue = isRetainer ? 0 : timeEntries
    .filter(e => e.billable)
    .reduce((sum, entry) => sum + ((entry.hours || 0) * projectRate), 0);

  // Retainer revenue
  const retainerRevenue = isRetainer ? (project?.monthly_retainer || 0) : 0;

  // Payroll costs
  const totalPayroll = timeEntries.reduce((sum, entry) => {
    const teamMember = teamMembers.find(tm => tm.id === entry.team_member_id);
    const memberRate = teamMember?.hourly_rate || 0;
    return sum + ((entry.hours || 0) * memberRate);
  }, 0);

  // Profit calculation
  const revenue = isRetainer ? retainerRevenue : hourlyRevenue;
  const profit = revenue - totalPayroll;
  const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const effectiveRate = totalHours > 0 ? (profit / totalHours) : 0;

  // Team breakdown
  const teamBreakdown = teamMembers
    .map(member => {
      const memberEntries = timeEntries.filter(e => e.team_member_id === member.id);
      const hours = memberEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
      const cost = hours * (member.hourly_rate || 0);
      return { ...member, hours, cost };
    })
    .filter(m => m.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  if (timeEntries.length === 0) {
    return (
      <div className="py-16 text-center">
        <Clock className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-[13px] text-gray-500">No time entries to analyze yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Inline metric pill strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
        <span>
          Hours <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{totalHours.toFixed(1)}h</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {isRetainer ? 'Retainer' : 'Revenue'} <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">${revenue.toLocaleString()}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Labor <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">${totalPayroll.toLocaleString()}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
          Profit <span className={`font-medium tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>${profit.toLocaleString()}</span>
          <span className="text-gray-400 dark:text-gray-500">· {profitMargin.toFixed(0)}%</span>
        </span>
        <span>
          Effective rate <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">${effectiveRate.toFixed(0)}/hr</span>
        </span>
        <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
          {profit >= 0 ? 'Profitable' : 'Unprofitable'}
        </span>
      </div>

      {/* Team Cost Breakdown */}
      {teamBreakdown.length > 0 && (
        <div>
          <div className="h-7 flex items-center text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Team cost breakdown
          </div>
          <div className="border-t border-gray-200 dark:border-gray-800">
            {teamBreakdown.map(member => (
              <div
                key={member.id}
                className="flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 dark:text-gray-300 flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                  {member.full_name?.charAt(0) || '?'}
                </div>
                <span className="flex-1 min-w-0 truncate text-[13px] text-gray-900 dark:text-gray-100 font-medium">
                  {member.full_name}
                </span>
                <span className="text-[12px] text-gray-500 tabular-nums w-28 text-right">
                  {member.hours.toFixed(1)}h @ ${member.hourly_rate || 0}/hr
                </span>
                <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 tabular-nums w-24 text-right">
                  ${member.cost.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
