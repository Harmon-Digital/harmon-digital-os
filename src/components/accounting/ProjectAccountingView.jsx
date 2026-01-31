import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Clock, Users } from "lucide-react";

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

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <Clock className="w-4 h-4" />
              Total Hours
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              {isRetainer ? 'Monthly Retainer' : 'Billable Revenue'}
            </div>
            <div className="text-2xl font-bold text-green-600">
              ${revenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <TrendingDown className="w-4 h-4" />
              Labor Cost
            </div>
            <div className="text-2xl font-bold text-red-600">
              ${totalPayroll.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <DollarSign className="w-4 h-4" />
              Net Profit
            </div>
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${profit.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">{profitMargin.toFixed(0)}% margin</div>
          </CardContent>
        </Card>
      </div>

      {/* Profitability Indicator */}
      <Card className={profit >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Project Profitability</p>
              <p className={`text-lg font-bold ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {profit >= 0 ? 'Profitable' : 'Unprofitable'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Effective Rate</p>
              <p className="text-lg font-bold text-gray-900">
                ${totalHours > 0 ? ((revenue - totalPayroll) / totalHours).toFixed(0) : 0}/hr
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Cost Breakdown */}
      {teamBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" />
              Team Cost Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teamBreakdown.map(member => (
                <div key={member.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-indigo-600">
                        {member.full_name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.full_name}</p>
                      <p className="text-xs text-gray-500">{member.hours.toFixed(1)}h @ ${member.hourly_rate || 0}/hr</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">${member.cost.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {timeEntries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No time entries to analyze yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
