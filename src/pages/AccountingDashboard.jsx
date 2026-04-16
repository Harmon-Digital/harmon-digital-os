import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight } from "lucide-react";

export default function AccountingDashboard() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalHours: 0,
    billableHours: 0,
    unbilledRevenue: 0,
    unpaidPayroll: 0,
    revenue: 0,
    laborCost: 0,
  });

  const isAdmin = userProfile?.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsRes, teamRes, timeRes] = await Promise.all([
        supabase.from("projects").select("id, hourly_rate"),
        supabase.from("team_members").select("id, hourly_rate"),
        supabase.from("time_entries").select("*")
      ]);

      const projects = projectsRes.data || [];
      const teamMembers = teamRes.data || [];
      const timeEntries = timeRes.data || [];

      const totalHours = timeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
      const billableHours = timeEntries.filter(e => e.billable).reduce((sum, e) => sum + (e.hours || 0), 0);

      const revenue = timeEntries
        .filter(e => e.billable)
        .reduce((sum, e) => {
          const project = projects.find(p => p.id === e.project_id);
          return sum + ((e.hours || 0) * (project?.hourly_rate || 0));
        }, 0);

      const unbilledRevenue = timeEntries
        .filter(e => e.billable && !e.client_billed)
        .reduce((sum, e) => {
          const project = projects.find(p => p.id === e.project_id);
          return sum + ((e.hours || 0) * (project?.hourly_rate || 0));
        }, 0);

      const laborCost = timeEntries.reduce((sum, e) => {
        const member = teamMembers.find(m => m.id === e.team_member_id);
        return sum + ((e.hours || 0) * (member?.hourly_rate || 0));
      }, 0);

      const unpaidPayroll = timeEntries
        .filter(e => !e.contractor_paid)
        .reduce((sum, e) => {
          const member = teamMembers.find(m => m.id === e.team_member_id);
          return sum + ((e.hours || 0) * (member?.hourly_rate || 0));
        }, 0);

      setStats({ totalHours, billableHours, unbilledRevenue, unpaidPayroll, revenue, laborCost });
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 mb-2">Admin Access Required</h2>
          <p className="text-[13px] text-gray-500">You need administrator privileges to view this page.</p>
        </div>
      </div>
    );
  }

  const profit = stats.revenue - stats.laborCost;
  const margin = stats.revenue > 0 ? (profit / stats.revenue) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-3 px-4 h-12">
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Accounting</h1>
          <span className="text-[13px] text-gray-500">Financial overview</span>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0">
        <div className="p-4 lg:p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-gray-200 dark:border-gray-800 border-t-gray-400 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Inline metric strip */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Total Hours <span className="text-gray-900 dark:text-gray-100 font-medium">{stats.totalHours.toFixed(1)}h</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Billable <span className="text-gray-900 dark:text-gray-100 font-medium">{stats.billableHours.toFixed(1)}h</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Revenue <span className="text-gray-900 dark:text-gray-100 font-medium">${stats.revenue.toLocaleString()}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Labor Cost <span className="text-gray-900 dark:text-gray-100 font-medium">${stats.laborCost.toLocaleString()}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Profit <span className={`font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${profit.toLocaleString()}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">({margin.toFixed(0)}%)</span>
                </span>
              </div>

              {/* Action items */}
              <div>
                <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">
                  Action Items
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Link
                    to={createPageUrl("Reports") + "?view=unbilled"}
                    className="border border-gray-200 dark:border-gray-800 rounded-md p-3 hover:border-gray-300 dark:border-gray-700 transition-colors"
                  >
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">Unbilled Revenue</div>
                    <div className="text-[22px] font-semibold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">
                      ${stats.unbilledRevenue.toLocaleString()}
                    </div>
                    <div className="text-[12px] text-gray-500 flex items-center gap-1 mt-1">
                      Click to invoice <ArrowRight className="w-3 h-3" />
                    </div>
                  </Link>

                  <Link
                    to={createPageUrl("Reports") + "?view=unpaid"}
                    className="border border-gray-200 dark:border-gray-800 rounded-md p-3 hover:border-gray-300 dark:border-gray-700 transition-colors"
                  >
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">Unpaid Payroll</div>
                    <div className="text-[22px] font-semibold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">
                      ${stats.unpaidPayroll.toLocaleString()}
                    </div>
                    <div className="text-[12px] text-gray-500 flex items-center gap-1 mt-1">
                      Click to pay <ArrowRight className="w-3 h-3" />
                    </div>
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
