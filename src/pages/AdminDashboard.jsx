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
import { User } from "@/api/entities";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  FolderKanban,
  Clock,
  AlertTriangle,
  Target,
  CreditCard,
  ArrowRight,
  ArrowUp,
  ArrowDown
} from "lucide-react";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
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
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      // Check if admin
      if (currentUser.role !== 'admin') {
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
        Invoice.list("-created_date", 100),
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
    const date = new Date(t.date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).reduce((sum, t) => sum + (t.amount || 0), 0);

  // Team Metrics
  const activeTeamMembers = teamMembers.filter(tm => tm.status === 'active').length;
  const totalHoursThisMonth = timeEntries.filter(te => {
    const date = new Date(te.date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).reduce((sum, te) => sum + (te.hours || 0), 0);

  const unbilledHours = timeEntries
    .filter(te => te.billable && !te.client_billed)
    .reduce((sum, te) => sum + (te.hours || 0), 0);

  const unbilledRevenue = unbilledHours * 150; // Assuming avg rate

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
    return new Date(inv.due_date) < new Date();
  });

  // Recent Payments
  const recentPayments = payments.slice(0, 5);

  // Team Utilization
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
      <div className="p-8">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Executive overview of your agency</p>
      </div>

      {/* Financial KPIs */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('Invoices'))}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
              <DollarSign className="w-5 h-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">${totalRevenue.toLocaleString()}</div>
              <p className="text-sm text-gray-500 mt-1">from paid invoices</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('Invoices'))}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Revenue</CardTitle>
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">${pendingRevenue.toLocaleString()}</div>
              <p className="text-sm text-gray-500 mt-1">{overdueInvoices.length} overdue invoices</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('StripeSync'))}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Monthly Recurring</CardTitle>
              <CreditCard className="w-5 h-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">${monthlyRecurring.toLocaleString()}</div>
              <p className="text-sm text-gray-500 mt-1">{subscriptions.filter(s => s.status === 'active').length} active subscriptions</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('TimeTracking'))}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Unbilled Hours</CardTitle>
              <Clock className="w-5 h-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{unbilledHours.toFixed(0)}</div>
              <p className="text-sm text-gray-500 mt-1">~${unbilledRevenue.toLocaleString()} potential</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Operations KPIs */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Operations Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('Projects'))}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Projects</CardTitle>
              <FolderKanban className="w-5 h-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{activeProjects}</div>
              {projectsAtRisk > 0 && (
                <p className="text-sm text-red-600 mt-1">{projectsAtRisk} at risk</p>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('Accounts'))}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Accounts</CardTitle>
              <Users className="w-5 h-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{activeAccounts}</div>
              {accountsAtRisk > 0 && (
                <p className="text-sm text-red-600 mt-1">{accountsAtRisk} at risk</p>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('Team'))}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Team Members</CardTitle>
              <Users className="w-5 h-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{activeTeamMembers}</div>
              <p className="text-sm text-gray-500 mt-1">{totalHoursThisMonth.toFixed(0)}h this month</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('CRM'))}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Sales Pipeline</CardTitle>
              <Target className="w-5 h-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">${pipelineValue.toLocaleString()}</div>
              <p className="text-sm text-gray-500 mt-1">{activePipeline.length} active leads</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overdue Invoices Alert */}
        {overdueInvoices.length > 0 && (
          <Card className="lg:col-span-2 border-red-200 bg-red-50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Overdue Invoices ({overdueInvoices.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 hover:bg-red-100"
                onClick={() => navigate(createPageUrl('Invoices'))}
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overdueInvoices.slice(0, 3).map(invoice => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{getAccountName(invoice.account_id)}</p>
                      <p className="text-sm text-gray-600">
                        Due: {new Date(invoice.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">${invoice.total?.toLocaleString()}</p>
                      <Badge variant="destructive" className="mt-1">Overdue</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Payments */}
        <Card className={overdueInvoices.length > 0 ? '' : 'lg:col-span-2'}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Payments</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(createPageUrl('Payments'))}
            >
              View All <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No payments yet</p>
            ) : (
              <div className="space-y-3">
                {recentPayments.map(payment => (
                  <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{getTeamMemberName(payment.team_member_id)}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">${payment.amount?.toLocaleString()}</p>
                      <Badge className={payment.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {payment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className={overdueInvoices.length > 0 ? 'lg:col-span-1' : 'lg:col-span-1'}>
          <CardHeader>
            <CardTitle>This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Transactions</span>
              <span className="font-bold text-green-600">${thisMonthTransactions.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Hours Logged</span>
              <span className="font-bold text-gray-900">{totalHoursThisMonth.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Tasks Completed</span>
              <span className="font-bold text-gray-900">
                {tasks.filter(t => t.status === 'completed').length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Deals Won</span>
              <span className="font-bold text-gray-900">{wonDeals}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Alerts */}
      {(projectsAtRisk > 0 || accountsAtRisk > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Risk Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectsAtRisk > 0 && (
                <div className="p-4 bg-white border border-orange-200 rounded-lg">
                  <p className="font-medium text-gray-900 mb-2">High Risk Projects</p>
                  <p className="text-sm text-gray-600 mb-3">
                    {projectsAtRisk} project{projectsAtRisk !== 1 ? 's' : ''} marked as high risk
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(createPageUrl('Projects'))}
                  >
                    Review Projects
                  </Button>
                </div>
              )}
              {accountsAtRisk > 0 && (
                <div className="p-4 bg-white border border-orange-200 rounded-lg">
                  <p className="font-medium text-gray-900 mb-2">High Risk Accounts</p>
                  <p className="text-sm text-gray-600 mb-3">
                    {accountsAtRisk} account{accountsAtRisk !== 1 ? 's' : ''} marked as high risk
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(createPageUrl('Accounts'))}
                  >
                    Review Accounts
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}