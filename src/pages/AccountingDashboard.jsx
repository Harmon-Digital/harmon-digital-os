import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { DollarSign, TrendingUp, TrendingDown, Clock, ArrowRight } from "lucide-react";

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

      // Calculate stats
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-500">You need administrator privileges to view this page.</p>
        </div>
      </div>
    );
  }

  const profit = stats.revenue - stats.laborCost;
  const margin = stats.revenue > 0 ? (profit / stats.revenue) * 100 : 0;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Accounting</h1>
        <p className="text-gray-500 text-sm">Financial overview</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Action Items */}
          <div className="grid grid-cols-2 gap-4">
            <Link to={createPageUrl("Reports") + "?view=unbilled"}>
              <Card className="hover:border-orange-300 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="text-sm text-gray-500 mb-1">Unbilled Revenue</div>
                  <div className="text-2xl font-bold text-orange-600">${stats.unbilledRevenue.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                    Click to invoice <ArrowRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to={createPageUrl("Reports") + "?view=unpaid"}>
              <Card className="hover:border-red-300 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="text-sm text-gray-500 mb-1">Unpaid Payroll</div>
                  <div className="text-2xl font-bold text-red-600">${stats.unpaidPayroll.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                    Click to pay <ArrowRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Total Hours</div>
                <div className="text-xl font-semibold">{stats.totalHours.toFixed(1)}h</div>
                <div className="text-xs text-gray-400">{stats.billableHours.toFixed(1)}h billable</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Revenue</div>
                <div className="text-xl font-semibold">${stats.revenue.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Labor Cost</div>
                <div className="text-xl font-semibold">${stats.laborCost.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Profit</div>
                <div className={`text-xl font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${profit.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">{margin.toFixed(0)}% margin</div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
