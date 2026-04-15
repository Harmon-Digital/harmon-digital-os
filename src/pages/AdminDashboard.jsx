import React, { useState, useEffect } from "react";
import {
  Invoice,
  TimeEntry,
  Project,
  Account,
  Task,
  Lead,
  TeamMember,
  Payment,
  Transaction,
  StripeSubscription
} from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl, parseLocalDate } from "@/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, ChevronRight } from "lucide-react";

export default function AdminDashboard() {
  const { user: authUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (userProfile) loadAdminData();
  }, [userProfile]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      if (userProfile?.role !== 'admin') {
        navigate(createPageUrl('Dashboard'));
        return;
      }

      const [
        invoicesData,
        timeEntriesData,
        projectsData,
        accountsData,
        tasksData,
        leadsData,
        teamMembersData,
        paymentsData,
        transactionsData,
        subscriptionsData
      ] = await Promise.all([
        Invoice.list("-created_at", 100),
        TimeEntry.list("-date", 500),
        Project.list(),
        Account.list(),
        Task.list(),
        Lead.list(),
        TeamMember.list(),
        Payment.list("-payment_date", 100),
        Transaction.list("-date", 100),
        StripeSubscription.list()
      ]);

      setInvoices(invoicesData);
      setTimeEntries(timeEntriesData);
      setProjects(projectsData);
      setAccounts(accountsData);
      setTasks(tasksData);
      setLeads(leadsData);
      setTeamMembers(teamMembersData);
      setPayments(paymentsData);
      setTransactions(transactionsData);
      setSubscriptions(subscriptionsData);
    } catch (error) {
      console.error("Error loading admin dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  // Financial Metrics
  const totalRevenue = invoices
    .filter(inv => inv.status === "paid")
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const pendingRevenue = invoices
    .filter(inv => inv.status === "sent" || inv.status === "overdue")
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const monthlyRecurring = subscriptions
    .filter(sub => sub.status === 'active')
    .reduce((sum, sub) => {
      if (sub.interval === 'month') return sum + (sub.amount || 0);
      if (sub.interval === 'year') return sum + ((sub.amount || 0) / 12);
      return sum;
    }, 0);

  const thisMonthTransactions = transactions.filter(t => {
    const date = parseLocalDate(t.date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).reduce((sum, t) => sum + (t.amount || 0), 0);

  // Team Metrics
  const activeTeamMembers = teamMembers.filter(tm => tm.status === 'active').length;
  const totalHoursThisMonth = timeEntries.filter(te => {
    const date = parseLocalDate(te.date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).reduce((sum, te) => sum + (te.hours || 0), 0);

  const unbilledHours = timeEntries
    .filter(te => te.billable && !te.client_billed)
    .reduce((sum, te) => sum + (te.hours || 0), 0);

  const unbilledRevenue = unbilledHours * 150;

  // Project Metrics
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const projectsAtRisk = projects.filter(p => p.risk_level === 'high' && p.status === 'active').length;

  // Client Metrics
  const activeAccounts = accounts.filter(a => a.status === 'active').length;
  const accountsAtRisk = accounts.filter(a => a.risk_level === 'high' && a.status === 'active').length;

  // Sales Metrics
  const activePipeline = leads.filter(l => l.status !== 'won' && l.status !== 'lost');
  const pipelineValue = activePipeline.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
  const wonDeals = leads.filter(l => l.status === 'won').length;

  // Overdue Invoices
  const overdueInvoices = invoices.filter(inv => {
    if (inv.status !== 'sent' && inv.status !== 'overdue') return false;
    return parseLocalDate(inv.due_date) < new Date();
  });

  const recentPayments = payments.slice(0, 5);

  const getTeamMemberName = (teamMemberId) => {
    const tm = teamMembers.find(t => t.id === teamMemberId);
    return tm?.full_name || 'Unknown';
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.company_name || 'Unknown';
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3 px-4 h-12">
            <h1 className="text-[15px] font-semibold text-gray-900">Admin Dashboard</h1>
          </div>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div className="border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 px-4 h-12">
          <h1 className="text-[15px] font-semibold text-gray-900">Admin Dashboard</h1>
          <span className="text-[13px] text-gray-500">Executive overview</span>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0">
        <div className="p-4 lg:p-6 space-y-4">
          {/* Financial metric strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              Revenue <span className="text-gray-900 font-medium">${totalRevenue.toLocaleString()}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              Pending <span className="text-gray-900 font-medium">${pendingRevenue.toLocaleString()}</span>
              {overdueInvoices.length > 0 && (
                <span className="text-red-600">({overdueInvoices.length} overdue)</span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              MRR <span className="text-gray-900 font-medium">${monthlyRecurring.toLocaleString()}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              Unbilled <span className="text-gray-900 font-medium">{unbilledHours.toFixed(0)}h</span>
              <span className="text-gray-400">(~${unbilledRevenue.toLocaleString()})</span>
            </span>
          </div>

          {/* Financial panels */}
          <div>
            <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">
              Financial Overview
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => navigate(createPageUrl('Accounting'))}
                className="text-left border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-colors"
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Total Revenue</div>
                <div className="text-[22px] font-semibold text-gray-900 tabular-nums mt-0.5">
                  ${totalRevenue.toLocaleString()}
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5">from paid invoices</div>
              </button>

              <button
                onClick={() => navigate(createPageUrl('Accounting'))}
                className="text-left border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-colors"
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Pending Revenue</div>
                <div className="text-[22px] font-semibold text-gray-900 tabular-nums mt-0.5">
                  ${pendingRevenue.toLocaleString()}
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5">{overdueInvoices.length} overdue invoices</div>
              </button>

              <button
                onClick={() => navigate(createPageUrl('Accounting'))}
                className="text-left border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-colors"
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Monthly Recurring</div>
                <div className="text-[22px] font-semibold text-gray-900 tabular-nums mt-0.5">
                  ${monthlyRecurring.toLocaleString()}
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5">
                  {subscriptions.filter(s => s.status === 'active').length} active subscriptions
                </div>
              </button>

              <button
                onClick={() => navigate(createPageUrl('TimeTracking'))}
                className="text-left border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-colors"
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Unbilled Hours</div>
                <div className="text-[22px] font-semibold text-gray-900 tabular-nums mt-0.5">
                  {unbilledHours.toFixed(0)}
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5">~${unbilledRevenue.toLocaleString()} potential</div>
              </button>
            </div>
          </div>

          {/* Operations panels */}
          <div>
            <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">
              Operations
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => navigate(createPageUrl('Projects'))}
                className="text-left border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-colors"
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Active Projects</div>
                <div className="text-[22px] font-semibold text-gray-900 tabular-nums mt-0.5">{activeProjects}</div>
                {projectsAtRisk > 0 && (
                  <div className="text-[12px] text-red-600 mt-0.5">{projectsAtRisk} at risk</div>
                )}
              </button>

              <button
                onClick={() => navigate(createPageUrl('Accounts'))}
                className="text-left border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-colors"
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Active Accounts</div>
                <div className="text-[22px] font-semibold text-gray-900 tabular-nums mt-0.5">{activeAccounts}</div>
                {accountsAtRisk > 0 && (
                  <div className="text-[12px] text-red-600 mt-0.5">{accountsAtRisk} at risk</div>
                )}
              </button>

              <button
                onClick={() => navigate(createPageUrl('Team'))}
                className="text-left border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-colors"
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Team Members</div>
                <div className="text-[22px] font-semibold text-gray-900 tabular-nums mt-0.5">{activeTeamMembers}</div>
                <div className="text-[12px] text-gray-500 mt-0.5">{totalHoursThisMonth.toFixed(0)}h this month</div>
              </button>

              <button
                onClick={() => navigate(createPageUrl('CRM'))}
                className="text-left border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-colors"
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Sales Pipeline</div>
                <div className="text-[22px] font-semibold text-gray-900 tabular-nums mt-0.5">
                  ${pipelineValue.toLocaleString()}
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5">{activePipeline.length} active leads</div>
              </button>
            </div>
          </div>

          {/* Two-column: Lists | This Month */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Overdue Invoices */}
            {overdueInvoices.length > 0 && (
              <div className="lg:col-span-2 border border-gray-200 rounded-md">
                <div className="flex items-center justify-between px-3 h-9 border-b border-gray-100">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    Overdue Invoices ({overdueInvoices.length})
                  </div>
                  <button
                    onClick={() => navigate(createPageUrl('Accounting'))}
                    className="text-[12px] text-gray-600 hover:text-gray-900 flex items-center gap-1"
                  >
                    View all <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div>
                  {overdueInvoices.slice(0, 5).map(invoice => (
                    <div
                      key={invoice.id}
                      className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 last:border-b-0"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-gray-900 font-medium truncate">
                          {getAccountName(invoice.account_id)}
                        </div>
                        <div className="text-[12px] text-gray-500">
                          Due {parseLocalDate(invoice.due_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-[13px] font-medium text-gray-900 tabular-nums">
                        ${invoice.total?.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Payments */}
            <div className={overdueInvoices.length > 0 ? 'border border-gray-200 rounded-md' : 'lg:col-span-2 border border-gray-200 rounded-md'}>
              <div className="flex items-center justify-between px-3 h-9 border-b border-gray-100">
                <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Recent Payments
                </div>
                <button
                  onClick={() => navigate(createPageUrl('Accounting'))}
                  className="text-[12px] text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div>
                {recentPayments.length === 0 ? (
                  <p className="text-center py-6 text-[13px] text-gray-500">No payments yet</p>
                ) : (
                  recentPayments.map(payment => (
                    <div
                      key={payment.id}
                      className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 last:border-b-0"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          payment.status === 'paid' ? 'bg-green-500' : 'bg-amber-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-gray-900 font-medium truncate">
                          {getTeamMemberName(payment.team_member_id)}
                        </div>
                        <div className="text-[12px] text-gray-500">
                          {parseLocalDate(payment.payment_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-[13px] font-medium text-gray-900 tabular-nums">
                        ${payment.amount?.toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* This Month */}
            <div className="border border-gray-200 rounded-md">
              <div className="px-3 h-9 border-b border-gray-100 flex items-center">
                <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  This Month
                </div>
              </div>
              <div className="p-3 space-y-2.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-gray-600">Transactions</span>
                  <span className="text-gray-900 font-medium tabular-nums">
                    ${thisMonthTransactions.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-gray-600">Hours Logged</span>
                  <span className="text-gray-900 font-medium tabular-nums">{totalHoursThisMonth.toFixed(0)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-gray-600">Tasks Completed</span>
                  <span className="text-gray-900 font-medium tabular-nums">{completedTasks}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-gray-600">Deals Won</span>
                  <span className="text-gray-900 font-medium tabular-nums">{wonDeals}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Alerts */}
          {(projectsAtRisk > 0 || accountsAtRisk > 0) && (
            <div>
              <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Risk Alerts
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectsAtRisk > 0 && (
                  <div className="border border-gray-200 rounded-md p-3">
                    <div className="text-[13px] font-medium text-gray-900">High Risk Projects</div>
                    <div className="text-[12px] text-gray-500 mt-0.5 mb-2">
                      {projectsAtRisk} project{projectsAtRisk !== 1 ? 's' : ''} marked as high risk
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[12px]"
                      onClick={() => navigate(createPageUrl('Projects'))}
                    >
                      Review Projects <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                )}
                {accountsAtRisk > 0 && (
                  <div className="border border-gray-200 rounded-md p-3">
                    <div className="text-[13px] font-medium text-gray-900">High Risk Accounts</div>
                    <div className="text-[12px] text-gray-500 mt-0.5 mb-2">
                      {accountsAtRisk} account{accountsAtRisk !== 1 ? 's' : ''} marked as high risk
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[12px]"
                      onClick={() => navigate(createPageUrl('Accounts'))}
                    >
                      Review Accounts <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
