import React, { useState, useEffect } from "react";
import { Invoice, Payment, TimeEntry, TeamMember, Expense, Transaction } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  FileText,
  Calendar,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

export default function AccountingDashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [timeRange, setTimeRange] = useState("this_month");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      if (currentUser.role !== "admin") {
        setLoading(false);
        return;
      }

      const [
        invoicesData,
        paymentsData,
        expensesData,
        transactionsData,
        timeEntriesData,
        teamMembersData
      ] = await Promise.all([
        Invoice.list("-created_date"),
        Payment.list("-payment_date"),
        Expense.list("-date"),
        Transaction.list("-date"),
        TimeEntry.list("-date"),
        TeamMember.list()
      ]);

      setInvoices(invoicesData);
      setPayments(paymentsData);
      setExpenses(expensesData);
      setTransactions(transactionsData);
      setTimeEntries(timeEntriesData);
      setTeamMembers(teamMembersData);
    } catch (error) {
      console.error("Error loading accounting data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data by time range
  const getFilteredData = () => {
    const now = new Date();
    let startDate = new Date();

    if (timeRange === "this_week") {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === "this_month") {
      startDate.setMonth(now.getMonth() - 1);
    } else if (timeRange === "this_quarter") {
      startDate.setMonth(now.getMonth() - 3);
    } else if (timeRange === "this_year") {
      startDate.setFullYear(now.getFullYear() - 1);
    } else if (timeRange === "all_time") {
      startDate = new Date(0);
    }

    return {
      invoices: invoices.filter(inv => new Date(inv.created_date) >= startDate),
      payments: payments.filter(pay => new Date(pay.payment_date) >= startDate),
      expenses: expenses.filter(exp => new Date(exp.date) >= startDate),
      transactions: transactions.filter(txn => new Date(txn.date) >= startDate),
      timeEntries: timeEntries.filter(te => new Date(te.date) >= startDate)
    };
  };

  const filtered = getFilteredData();

  // Calculate key metrics
  const revenue = filtered.invoices
    .filter(inv => inv.status === "paid")
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const stripeIncome = filtered.transactions
    .filter(txn => txn.status === "succeeded" && txn.type !== "refund")
    .reduce((sum, txn) => sum + (txn.amount || 0), 0);

  const totalIncome = revenue + stripeIncome;

  // Calculate payroll costs
  const payrollCosts = filtered.payments
    .filter(pay => pay.status === "paid")
    .reduce((sum, pay) => sum + (pay.amount || 0), 0);

  // Calculate other expenses
  const otherExpenses = filtered.expenses
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const totalExpenses = payrollCosts + otherExpenses;

  // Calculate labor costs from time entries
  const laborCosts = filtered.timeEntries.reduce((sum, entry) => {
    const teamMember = teamMembers.find(tm => tm.id === entry.team_member_id);
    const hourlyRate = teamMember?.hourly_rate || 0;
    return sum + ((entry.hours || 0) * hourlyRate);
  }, 0);

  const netIncome = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0;

  // Unbilled hours
  const unbilledHours = timeEntries
    .filter(te => te.billable && !te.client_billed)
    .reduce((sum, te) => sum + (te.hours || 0), 0);

  // Outstanding invoices
  const outstandingInvoices = invoices
    .filter(inv => inv.status === "sent" || inv.status === "overdue")
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  // Monthly income vs expenses chart
  const getMonthlyData = () => {
    const months = {};
    const now = new Date();
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      months[key] = { month: key, income: 0, expenses: 0, profit: 0 };
    }

    // Add income
    filtered.invoices
      .filter(inv => inv.status === "paid" && inv.paid_date)
      .forEach(inv => {
        const date = new Date(inv.paid_date);
        const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (months[key]) {
          months[key].income += inv.total || 0;
        }
      });

    // Add Stripe income
    filtered.transactions
      .filter(txn => txn.status === "succeeded")
      .forEach(txn => {
        const date = new Date(txn.date);
        const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (months[key]) {
          months[key].income += txn.amount || 0;
        }
      });

    // Add expenses
    filtered.payments.forEach(pay => {
      const date = new Date(pay.payment_date);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (months[key]) {
        months[key].expenses += pay.amount || 0;
      }
    });

    filtered.expenses.forEach(exp => {
      const date = new Date(exp.date);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (months[key]) {
        months[key].expenses += exp.amount || 0;
      }
    });

    // Calculate profit
    Object.values(months).forEach(month => {
      month.profit = month.income - month.expenses;
    });

    return Object.values(months);
  };

  const monthlyData = getMonthlyData();

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">This page is only accessible to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financial Overview</h1>
          <p className="text-gray-500 mt-1">Income, expenses, and profitability</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
            <SelectItem value="all_time">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">
              ${totalIncome.toLocaleString()}
            </div>
            <p className="text-xs text-green-700 mt-1">
              Invoices + Stripe
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">
              ${totalExpenses.toLocaleString()}
            </div>
            <p className="text-xs text-red-700 mt-1">
              Payroll: ${payrollCosts.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${netIncome >= 0 ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-orange-50 to-orange-100 border-orange-200'}`}>
          <CardHeader className="pb-3">
            <CardTitle className={`text-sm font-medium ${netIncome >= 0 ? 'text-blue-800' : 'text-orange-800'} flex items-center gap-2`}>
              <DollarSign className="w-4 h-4" />
              Net Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${netIncome >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
              ${netIncome.toLocaleString()}
            </div>
            <p className={`text-xs ${netIncome >= 0 ? 'text-blue-700' : 'text-orange-700'} mt-1`}>
              {profitMargin.toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-800 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Labor Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">
              ${laborCosts.toLocaleString()}
            </div>
            <p className="text-xs text-purple-700 mt-1">
              From time tracking
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Income vs Expenses (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="income" fill="#10b981" name="Income" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Profit Trend Line Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profit Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Action Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white rounded border border-orange-200">
              <div>
                <p className="font-semibold text-gray-900">Unbilled Hours</p>
                <p className="text-sm text-gray-600">{unbilledHours.toFixed(1)} hours not invoiced</p>
              </div>
              <Link to={createPageUrl("TimeTracking")}>
                <Button size="sm" variant="outline">
                  View <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded border border-orange-200">
              <div>
                <p className="font-semibold text-gray-900">Outstanding Invoices</p>
                <p className="text-sm text-gray-600">${outstandingInvoices.toLocaleString()} pending</p>
              </div>
              <Link to={createPageUrl("Invoices")}>
                <Button size="sm" variant="outline">
                  View <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-indigo-200 bg-indigo-50">
          <CardHeader>
            <CardTitle className="text-indigo-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to={createPageUrl("Invoices")}>
              <Button variant="outline" className="w-full justify-start">
                Create Invoice
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
            <Link to={createPageUrl("Payments")}>
              <Button variant="outline" className="w-full justify-start">
                Record Payment
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
            <Link to={createPageUrl("StripeSync")}>
              <Button variant="outline" className="w-full justify-start">
                Sync Stripe Data
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
            <Link to={createPageUrl("Reports")}>
              <Button variant="outline" className="w-full justify-start">
                View Detailed Reports
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}