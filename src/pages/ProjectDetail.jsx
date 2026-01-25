
import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Project, Account, Task, TimeEntry, Contact, User, Invoice, TeamMember } from "@/api/entities";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Users,
  Calendar,
  Mail,
  Phone,
  Edit,
  TrendingUp,
  FileText,
  Plus,
  Trash2,
  Save,
  X,
  TrendingDown,
  Copy,
  Check,
  HelpCircle,
  Ticket,
  RefreshCw // Added RefreshCw icon
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import TaskForm from "../components/tasks/TaskForm";
import TimeEntryForm from "../components/time/TimeEntryForm";
import ContactForm from "../components/contacts/ContactForm";
import ProjectAccountingView from "../components/accounting/ProjectAccountingView";
import { base44 } from "@/api/base44Client"; // Added base44 import

export default function ProjectDetail() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('id');

  const [project, setProject] = useState(null);
  const [account, setAccount] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]); // Added subscriptions state
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editedProject, setEditedProject] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showTimeDrawer, setShowTimeDrawer] = useState(false);
  const [editingTimeEntry, setEditingTimeEntry] = useState(null);
  const [showContactDrawer, setShowContactDrawer] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ open: false, type: null, id: null });
  const [copySuccess, setCopySuccess] = useState({ key: false, url: false });

  useEffect(() => {
    if (projectId) {
      loadProjectData();
    }
  }, [projectId]);

  const loadProjectData = async () => {
    setLoading(true);
    try {
      const allProjects = await Project.list();
      const currentProject = allProjects.find(p => p.id === projectId);

      if (!currentProject) {
        setLoading(false);
        return;
      }

      setProject(currentProject);
      setEditedProject(currentProject);

      const [accountData, tasksData, timeData, contactsData, usersData, invoicesData, teamMembersData, subscriptionsData, user] = await Promise.all([
        Account.list(),
        Task.filter({ project_id: projectId }),
        TimeEntry.filter({ project_id: projectId }),
        Contact.list(),
        User.list(),
        Invoice.list(),
        TeamMember.list(),
        base44.entities.StripeSubscription.list(), // Fetch subscriptions
        User.me()
      ]);

      setCurrentUser(user);
      const projectAccount = accountData.find(a => a.id === currentProject.account_id);
      setAccount(projectAccount);
      setAllAccounts(accountData);
      setTasks(tasksData);
      setTimeEntries(timeData);
      setContacts(contactsData.filter(c => c.account_id === currentProject.account_id));
      setUsers(usersData);
      setTeamMembers(teamMembersData);
      // Filter invoices that are linked to this project directly or through its time entries
      setInvoices(invoicesData.filter(inv =>
        inv.project_id === projectId || inv.time_entry_ids?.some(teId => timeData.some(te => te.id === teId))
      ));
      // Filter subscriptions that are linked to this project
      setSubscriptions(subscriptionsData.filter(sub => sub.project_id === projectId));
    } catch (error) {
      console.error("Error loading project:", error);
    } finally {
      setLoading(false);
    }
  };

  // Generate API key if project doesn't have one
  const generateApiKey = async () => {
    if (!project.api_key) {
      const newApiKey = 'pk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      await Project.update(projectId, { ...project, api_key: newApiKey });
      setProject({ ...project, api_key: newApiKey });
      setEditedProject({ ...editedProject, api_key: newApiKey });
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess({ ...copySuccess, [type]: true });
      setTimeout(() => setCopySuccess({ ...copySuccess, [type]: false }), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleProjectFieldChange = (field, value) => {
    setEditedProject({...editedProject, [field]: value});
    setHasChanges(true);
  };

  const handleSaveProject = async () => {
    try {
      await Project.update(projectId, editedProject);
      setProject(editedProject);
      setHasChanges(false);

      // Reload account data in case account changed
      if (editedProject.account_id !== project.account_id) {
        const accountData = await Account.list();
        const projectAccount = accountData.find(a => a.id === editedProject.account_id);
        setAccount(projectAccount);
      }
    } catch (error) {
      console.error("Error updating project:", error);
    }
  };

  const handleCancelChanges = () => {
    setEditedProject(project);
    setHasChanges(false);
  };

  const handleTaskSubmit = async (taskData) => {
    try {
      if (editingTask) {
        await Task.update(editingTask.id, taskData);
      } else {
        await Task.create({ ...taskData, project_id: projectId });
      }
      setShowTaskDrawer(false);
      setEditingTask(null);
      loadProjectData();
    } catch (error) {
      console.error("Error saving task:", error);
    }
  };

  const handleTimeSubmit = async (timeData) => {
    try {
      if (editingTimeEntry) {
        await TimeEntry.update(editingTimeEntry.id, timeData);
      } else {
        const currentUser = await User.me();
        await TimeEntry.create({ ...timeData, project_id: projectId, user_id: currentUser.id });
      }
      setShowTimeDrawer(false);
      setEditingTimeEntry(null);
      loadProjectData();
    } catch (error) {
      console.error("Error saving time entry:", error);
    }
  };

  const handleContactSubmit = async (contactData) => {
    try {
      if (editingContact) {
        await Contact.update(editingContact.id, contactData);
      } else {
        await Contact.create({ ...contactData, account_id: project.account_id });
      }
      setShowContactDrawer(false);
      setEditingContact(null);
      loadProjectData();
    } catch (error) {
      console.error("Error saving contact:", error);
    }
  };

  const handleDelete = async () => {
    const { type, id } = deleteConfirmDialog;
    try {
      if (type === 'task') {
        await Task.delete(id);
      } else if (type === 'time') {
        await TimeEntry.delete(id);
      } else if (type === 'contact') {
        await Contact.delete(id);
      }
      setDeleteConfirmDialog({ open: false, type: null, id: null });
      loadProjectData();
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

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

  if (!project) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Project not found</h2>
          <Link to={createPageUrl("Projects")}>
            <Button>Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin";
  const currentTeamMember = teamMembers.find(tm => tm.user_id === currentUser?.id);

  // Calculate current month hours for retainer projects
  const getCurrentMonthHours = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return timeEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= startOfMonth && entryDate <= endOfMonth;
    }).reduce((sum, entry) => sum + (entry.hours || 0), 0);
  };

  // Get last 6 months of data for rolling view
  const getMonthlyHoursHistory = () => {
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const monthHours = timeEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= startOfMonth && entryDate <= endOfMonth;
      }).reduce((sum, entry) => sum + (entry.hours || 0), 0);

      months.push({
        label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        hours: monthHours,
        budget: project.budget_hours || 0,
        isOverBudget: monthHours > (project.budget_hours || 0)
      });
    }

    return months;
  };

  const isRetainer = project.billing_type === 'retainer';
  const currentMonthHours = isRetainer ? getCurrentMonthHours() : 0;
  const monthlyBudget = isRetainer ? project.budget_hours || 0 : 0;
  const monthlyHistory = isRetainer ? getMonthlyHoursHistory() : [];

  const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const budgetHours = project.budget_hours || 0;

  // Adjusted hoursRemaining and completionPercentage calculation based on billing type
  const hoursToTrack = isRetainer ? currentMonthHours : totalHours;
  const budgetForProgress = isRetainer ? monthlyBudget : budgetHours;

  const hoursRemaining = budgetForProgress - hoursToTrack;
  const completionPercentage = budgetForProgress > 0 ? (hoursToTrack / budgetForProgress) * 100 : 0;

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const taskCompletionPercentage = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

  // Calculate labor costs (team member hourly rates × hours worked)
  const laborCost = timeEntries.reduce((sum, entry) => {
    const teamMember = teamMembers.find(tm => tm.id === entry.team_member_id);
    const hourlyRate = teamMember?.hourly_rate || 0;
    return sum + ((entry.hours || 0) * hourlyRate);
  }, 0);

  // Calculate income from invoices - this is a general income metric, will be replaced in admin view
  const invoiceIncome = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  // Calculate expected revenue based on billing type
  let expectedRevenue = 0;
  const billableHours = timeEntries.filter(te => te.billable).reduce((sum, entry) => sum + (entry.hours || 0), 0);

  if (project.billing_type === "retainer") {
    expectedRevenue = project.retainer_monthly || 0;
  } else if (project.billing_type === "hourly") {
    expectedRevenue = billableHours * (project.hourly_rate || account?.hourly_rate || 0);
  } else if (project.billing_type === "fixed") {
    expectedRevenue = project.budget || 0;
  }

  // Calculate time-based revenue (all billable hours)
  const projectRate = project.hourly_rate || 0;
  const timeBasedRevenue = billableHours * projectRate;

  // Calculate billed revenue (only client_billed hours)
  const billedHours = timeEntries.filter(te => te.client_billed).reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const billedRevenue = billedHours * projectRate;

  // Profit calculation (old logic)
  const profit = invoiceIncome - laborCost;
  const profitMargin = invoiceIncome > 0 ? (profit / invoiceIncome) * 100 : 0;

  // Weekly hours calculation
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weeklyHours = timeEntries
    .filter(entry => new Date(entry.date) >= oneWeekAgo)
    .reduce((sum, entry) => sum + (entry.hours || 0), 0);

  const weeklyMinimum = project.weekly_hour_minimum || 0;
  const weeklyProgress = weeklyMinimum > 0 ? (weeklyHours / weeklyMinimum) * 100 : 0;


  const statusColors = {
    active: "bg-green-100 text-green-800",
    completed: "bg-blue-100 text-blue-800",
    on_hold: "bg-yellow-100 text-yellow-800",
    cancelled: "bg-red-100 text-red-800"
  };

  const riskColors = {
    low: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-red-100 text-red-700"
  };

  const getUserName = (userId) => {
    // Modified to use teamMembers for consistency with accounting logic
    const teamMember = teamMembers.find(tm => tm.user_id === userId);
    return teamMember?.full_name || "Unassigned";
  };

  const getTeamMemberNameById = (teamMemberId) => {
    const member = teamMembers.find(tm => tm.id === teamMemberId);
    return member?.full_name || "Unknown";
  };

  const tasksByStatus = {
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  const totalInvoiced = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  // Determine progress bar color
  const getProgressColor = () => {
    if (completionPercentage >= 100) return "bg-red-500";
    if (completionPercentage >= 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 lg:p-8">
      <Link to={createPageUrl("Projects")} className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Projects
      </Link>

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          {account?.logo_url ? (
            <img src={account.logo_url} alt={account.company_name} className="w-16 h-16 rounded object-cover" />
          ) : (
            <div className="w-16 h-16 bg-indigo-100 rounded flex items-center justify-center">
              <Users className="w-8 h-8 text-indigo-600" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600 mt-1">{account?.company_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className={statusColors[project.status]}>
            {project.status.replace('_', ' ')}
          </Badge>
          <Badge className={riskColors[project.risk_level || 'low']}>
            {(project.risk_level || 'low').toUpperCase()} Risk
          </Badge>
        </div>
      </div>

      {/* Hours Budget Progress - Updated for Retainer Monthly Tracking */}
      {budgetHours > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {isRetainer ? `Monthly Retainer Hours - ${currentMonth}` : 'Hours Budget Progress'}
              </span>
              <span className="text-sm font-normal text-gray-600">
                {isRetainer ? `${currentMonthHours.toFixed(1)} / ${monthlyBudget} hours this month` : `${totalHours.toFixed(1)} / ${budgetHours} hours total`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Current Progress Bar */}
              <div className="space-y-2">
                <Progress value={completionPercentage} className="h-3" indicatorClassName={getProgressColor()} />
                <div className="flex justify-between text-sm">
                  <span className={`font-semibold ${hoursRemaining < 0 ? 'text-red-600' : hoursRemaining < budgetForProgress * 0.2 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {hoursRemaining >= 0
                      ? `${hoursRemaining.toFixed(1)} hours remaining${isRetainer ? ' this month' : ''}`
                      : `${Math.abs(hoursRemaining).toFixed(1)} hours over budget${isRetainer ? ' this month' : ''}`}
                  </span>
                  <span className="text-gray-600">{completionPercentage.toFixed(0)}% used</span>
                </div>
              </div>

              {/* Rolling 6-Month View for Retainers */}
              {isRetainer && monthlyHistory.length > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Last 6 Months</h4>
                  <div className="space-y-2">
                    {monthlyHistory.map((month, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-600">{month.label}</span>
                          <span className={`font-semibold ${month.isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
                            {month.hours.toFixed(1)}h / {month.budget}h
                            {month.isOverBudget && ` (+${(month.hours - month.budget).toFixed(1)}h)`}
                          </span>
                        </div>
                        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`absolute top-0 left-0 h-full transition-all ${
                              month.hours >= month.budget
                                ? 'bg-red-500'
                                : month.hours >= month.budget * 0.8
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min((month.hours / month.budget) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {monthlyHistory.some(m => m.isOverBudget) && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs text-red-800">
                        <strong>⚠️ Note:</strong> Months with red bars exceeded the retainer budget. Consider discussing scope or additional billing with the client.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {isAdmin && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Time-Based Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  ${timeBasedRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-gray-500 mt-1">{billableHours.toFixed(1)}h billable</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Billed Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${billedRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-gray-500 mt-1">{billedHours.toFixed(1)}h billed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Labor Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  ${laborCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-gray-500 mt-1">{totalHours.toFixed(1)}h logged</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Net Margin
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${billedRevenue - laborCost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${(billedRevenue - laborCost).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {billedRevenue > 0 ? (((billedRevenue - laborCost) / billedRevenue) * 100).toFixed(1) : 0}% margin
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {!isAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Total Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {totalHours.toFixed(1)}h
              </div>
              <p className="text-xs text-gray-500 mt-1">{billableHours.toFixed(1)}h billable</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Weekly Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {weeklyHours.toFixed(1)}h
              {weeklyMinimum > 0 && <span className="text-lg text-gray-500"> / {weeklyMinimum}h</span>}
            </div>
            {weeklyMinimum > 0 && (
              <>
                <Progress value={weeklyProgress} className="mt-2" />
                <p className="text-xs text-gray-500 mt-1">
                  {weeklyProgress >= 100 ? '✓ ' : ''}
                  {weeklyProgress.toFixed(0)}% of minimum
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics for Retainer - Admin Only */}
      {isAdmin && project.billing_type === "retainer" && project.retainer_monthly && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Retainer Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Monthly Retainer</p>
                <p className="text-2xl font-bold text-gray-900">${project.retainer_monthly.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Labor Cost (This Month)</p>
                <p className="text-2xl font-bold text-red-600">${laborCost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Retainer Value</p>
                <p className={`text-2xl font-bold ${laborCost <= project.retainer_monthly ? 'text-green-600' : 'text-red-600'}`}>
                  {laborCost <= project.retainer_monthly ? 'Under' : 'Over'} Budget
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ${Math.abs(project.retainer_monthly - laborCost).toLocaleString()} {laborCost <= project.retainer_monthly ? 'remaining' : 'over'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for different sections */}
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="time">Time Entries ({timeEntries.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="reports">Reports</TabsTrigger>}
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="billing">Billing ({invoices.length + subscriptions.length})</TabsTrigger>
          <TabsTrigger value="api">
            <Ticket className="w-4 h-4 mr-2" />
            Ticket API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input
                    value={editedProject?.name || ''}
                    onChange={(e) => handleProjectFieldChange('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select
                    value={editedProject?.account_id}
                    onValueChange={(value) => handleProjectFieldChange('account_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editedProject?.description || ''}
                  onChange={(e) => handleProjectFieldChange('description', e.target.value)}
                  rows={4}
                  placeholder="Project description..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editedProject?.status}
                    onValueChange={(value) => handleProjectFieldChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Risk Level</Label>
                  <Select
                    value={editedProject?.risk_level || 'low'}
                    onValueChange={(value) => handleProjectFieldChange('risk_level', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Project Type</Label>
                  <Select
                    value={editedProject?.project_type}
                    onValueChange={(value) => handleProjectFieldChange('project_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web_development">Web Development</SelectItem>
                      <SelectItem value="mobile_app">Mobile App</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="consulting">Consulting</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isAdmin && (
                <>
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">Budget & Billing</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Billing Type</Label>
                        <Select
                          value={editedProject?.billing_type}
                          onValueChange={(value) => handleProjectFieldChange('billing_type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="fixed">Fixed Price</SelectItem>
                            <SelectItem value="retainer">Retainer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Hourly Rate ($)</Label>
                        <Input
                          type="number"
                          value={editedProject?.hourly_rate || ''}
                          onChange={(e) => handleProjectFieldChange('hourly_rate', parseFloat(e.target.value) || 0)}
                          placeholder="150.00"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      {editedProject?.billing_type === 'retainer' && (
                        <div className="space-y-2">
                          <Label>Monthly Retainer ($)</Label>
                          <Input
                            type="number"
                            value={editedProject?.retainer_monthly || ''}
                            onChange={(e) => handleProjectFieldChange('retainer_monthly', parseFloat(e.target.value) || 0)}
                            placeholder="5000.00"
                          />
                        </div>
                      )}
                      {editedProject?.billing_type === 'fixed' && (
                        <div className="space-y-2">
                          <Label>Fixed Budget ($)</Label>
                          <Input
                            type="number"
                            value={editedProject?.budget || ''}
                            onChange={(e) => handleProjectFieldChange('budget', parseFloat(e.target.value) || 0)}
                            placeholder="10000.00"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Budget Hours</Label>
                        <Input
                          type="number"
                          value={editedProject?.budget_hours || ''}
                          onChange={(e) => handleProjectFieldChange('budget_hours', parseFloat(e.target.value) || 0)}
                          placeholder="100"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      <div className="space-y-2">
                        <Label>Weekly Hour Minimum</Label>
                        <Input
                          type="number"
                          value={editedProject?.weekly_hour_minimum || ''}
                          onChange={(e) => handleProjectFieldChange('weekly_hour_minimum', parseFloat(e.target.value) || 0)}
                          placeholder="10"
                        />
                        <p className="text-xs text-gray-500">Expected minimum hours per week</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Timeline</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={editedProject?.start_date || ''}
                      onChange={(e) => handleProjectFieldChange('start_date', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={editedProject?.end_date || ''}
                      onChange={(e) => handleProjectFieldChange('end_date', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {hasChanges && (
                <div className="flex justify-end gap-3 pt-6 border-t">
                  <Button variant="outline" onClick={handleCancelChanges}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSaveProject} className="bg-indigo-600 hover:bg-indigo-700">
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          {/* Task Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">To Do</div>
                <div className="text-2xl font-bold text-gray-900">{tasksByStatus.todo}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">In Progress</div>
                <div className="text-2xl font-bold text-blue-600">{tasksByStatus.in_progress}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Review</div>
                <div className="text-2xl font-bold text-yellow-600">{tasksByStatus.review}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Completed</div>
                <div className="text-2xl font-bold text-green-600">{tasksByStatus.completed}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tasks Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Tasks</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setEditingTask(null);
                  setShowTaskDrawer(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No tasks yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map(task => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>{getUserName(task.assigned_to)}</TableCell>
                        <TableCell>
                          <Badge className={
                            task.status === 'completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            task.status === 'review' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTask(task);
                                setShowTaskDrawer(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirmDialog({ open: true, type: 'task', id: task.id })}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Time Entries</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setEditingTimeEntry(null);
                  setShowTimeDrawer(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Time
              </Button>
            </CardHeader>
            <CardContent>
              {timeEntries.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No time entries yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Team Member</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Billable</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                        <TableCell>{getTeamMemberNameById(entry.team_member_id)}</TableCell>
                        <TableCell className="max-w-xs truncate">{entry.description || '—'}</TableCell>
                        <TableCell>{entry.hours}h</TableCell>
                        <TableCell>
                          <Badge className={entry.billable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                            {entry.billable ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTimeEntry(entry);
                                setShowTimeDrawer(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirmDialog({ open: true, type: 'time', id: entry.id })}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Updated Reports Tab (was Accounting) - Admin Only */}
        {isAdmin && (
          <TabsContent value="reports">
            <ProjectAccountingView
              projectId={projectId}
              timeEntries={timeEntries}
              teamMembers={teamMembers}
              project={project}
            />
          </TabsContent>
        )}

        <TabsContent value="contacts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Project Contacts</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setEditingContact(null);
                  setShowContactDrawer(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No contacts</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contacts.map(contact => (
                    <Card key={contact.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">
                              {contact.first_name} {contact.last_name}
                            </h3>
                            <p className="text-sm text-gray-600">{contact.title}</p>
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Mail className="w-4 h-4" />
                                <a href={`mailto:${contact.email}`} className="hover:text-indigo-600">
                                  {contact.email}
                                </a>
                              </div>
                              {contact.phone && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Phone className="w-4 h-4" />
                                  <a href={`tel:${contact.phone}`} className="hover:text-indigo-600">
                                    {contact.phone}
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingContact(contact);
                                  setShowContactDrawer(true);
                                }}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteConfirmDialog({ open: true, type: 'contact', id: contact.id })}
                              >
                                <Trash2 className="w-3 h-3 mr-1 text-red-600" />
                                Delete
                              </Button>
                            </div>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {contact.role}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Updated Billing Tab (was Invoices) */}
        <TabsContent value="billing">
          <div className="space-y-6">
            {/* Subscriptions Section */}
            {subscriptions.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="w-5 h-5" />
                      Active Subscriptions
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {subscriptions.map((subscription) => (
                      <div key={subscription.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {subscription.product_name || 'Subscription'}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {subscription.interval && `Billed ${subscription.interval}ly`}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Current period: {subscription.current_period_start ? new Date(subscription.current_period_start).toLocaleDateString() : '—'} - {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xl font-bold text-gray-900">
                              ${(subscription.amount || 0).toLocaleString()}
                              <span className="text-sm text-gray-500">/{subscription.interval || 'month'}</span>
                            </div>
                          </div>
                          <Badge className={
                            subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                            subscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                            subscription.status === 'past_due' ? 'bg-red-100 text-red-800' :
                            subscription.status === 'canceled' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }>
                            {subscription.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Invoices Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No invoices yet</p>
                ) : (
                  <div className="space-y-4">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Due: {new Date(invoice.due_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xl font-bold text-gray-900">
                              ${(invoice.total || 0).toLocaleString()}
                            </div>
                          </div>
                          <Badge className={
                            invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                            invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {invoice.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Empty State for Billing Tab */}
            {subscriptions.length === 0 && invoices.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No billing records yet</h3>
                <p className="text-gray-500">Invoices and subscriptions for this project will appear here</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* New Ticket API Tab */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5" />
                Ticket API Configuration
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-4 h-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="font-semibold mb-2">Create tickets from external systems</p>
                      <p className="text-xs">Use this API to create tickets/tasks in this project from Zapier, Make.com, Typeform, or any webhook-enabled service. Tickets appear in the Tasks page.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!project.api_key ? (
                <div className="text-center py-8">
                  <Ticket className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-600 mb-4">No API key generated yet</p>
                  <Button onClick={generateApiKey} className="bg-indigo-600 hover:bg-indigo-700">
                    Generate API Key
                  </Button>
                </div>
              ) : (
                <>
                  {/* API Endpoint */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      API Endpoint
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        POST
                      </Badge>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={`${window.location.origin}/functions/createTicket`}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(`${window.location.origin}/functions/createTicket`, 'url')}
                      >
                        {copySuccess.url ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      API Key
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        Secret
                      </Badge>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={project.api_key}
                        readOnly
                        type="password"
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(project.api_key, 'key')}
                      >
                        {copySuccess.key ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Keep this key secret. Include it in the X-API-Key header.</p>
                  </div>

                  {/* Example Request */}
                  <div className="space-y-2">
                    <Label>Example Request (cURL)</Label>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-xs font-mono">
{`curl -X POST ${window.location.origin}/functions/createTicket \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${project.api_key}" \\
  -d '{
    "title": "Website bug report",
    "description": "Button not working on homepage",
    "priority": "high",
    "requester_name": "John Doe",
    "requester_email": "john@example.com",
    "external_source": "Typeform"
  }'`}
                      </pre>
                    </div>
                  </div>

                  {/* Field Documentation */}
                  <div className="space-y-2">
                    <Label>Request Body Fields</Label>
                    <div className="border rounded-lg divide-y">
                      <div className="p-3 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono text-indigo-600">title</code>
                          <Badge variant="outline" className="text-xs">required</Badge>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Ticket title/summary</p>
                      </div>
                      <div className="p-3">
                        <code className="text-sm font-mono">description</code>
                        <p className="text-xs text-gray-600 mt-1">Detailed description</p>
                      </div>
                      <div className="p-3 bg-gray-50">
                        <code className="text-sm font-mono">priority</code>
                        <p className="text-xs text-gray-600 mt-1">low, medium, high, or urgent (default: medium)</p>
                      </div>
                      <div className="p-3">
                        <code className="text-sm font-mono">status</code>
                        <p className="text-xs text-gray-600 mt-1">todo, in_progress, review, or completed (default: todo)</p>
                      </div>
                      <div className="p-3 bg-gray-50">
                        <code className="text-sm font-mono">requester_name</code>
                        <p className="text-xs text-gray-600 mt-1">Name of person submitting the ticket</p>
                      </div>
                      <div className="p-3">
                        <code className="text-sm font-mono">requester_email</code>
                        <p className="text-xs text-gray-600 mt-1">Email of person submitting the ticket</p>
                      </div>
                      <div className="p-3 bg-gray-50">
                        <code className="text-sm font-mono">external_source</code>
                        <p className="text-xs text-gray-600 mt-1">System name (e.g., "Typeform", "Zapier", "Slack")</p>
                      </div>
                      <div className="p-3">
                        <code className="text-sm font-mono">external_id</code>
                        <p className="text-xs text-gray-600 mt-1">ID from external system for reference</p>
                      </div>
                      <div className="p-3 bg-gray-50">
                        <code className="text-sm font-mono">due_date</code>
                        <p className="text-xs text-gray-600 mt-1">Due date in YYYY-MM-DD format</p>
                      </div>
                      <div className="p-3">
                        <code className="text-sm font-mono">estimated_hours</code>
                        <p className="text-xs text-gray-600 mt-1">Estimated hours to complete</p>
                      </div>
                    </div>
                  </div>

                  {/* Integration Tips */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4" />
                      Integration Tips
                    </h4>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• <strong>Zapier/Make:</strong> Use "Webhooks by Zapier" or "HTTP Request" module</li>
                      <li>• <strong>Typeform:</strong> Set up webhook in Settings → Webhooks</li>
                      <li>• <strong>Slack:</strong> Create slash command or use incoming webhooks</li>
                      <li>• <strong>Email:</strong> Use email parser services like Mailgun or SendGrid</li>
                      <li>• Tickets appear instantly in the <Link to={createPageUrl("Tasks")} className="underline font-semibold">Tasks page</Link></li>
                      <li>• Team can assign, update status, and track tickets like any other task</li>
                      <li>• Each ticket gets an auto-incremented ticket number (#1, #2, #3...)</li>
                    </ul>
                  </div>

                  {/* Response Example */}
                  <div className="space-y-2">
                    <Label>Example Response</Label>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-xs font-mono">
{`{
  "success": true,
  "ticket": {
    "id": "abc123",
    "ticket_number": 42,
    "title": "Website bug report",
    "status": "todo",
    "priority": "high",
    "project_id": "${projectId}",
    "project_name": "${project.name}",
    "created_date": "2025-01-15T10:30:00Z"
  },
  "message": "Ticket #42 created successfully for project \\"${project.name}\\""
}`}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Task Drawer */}
      <Sheet open={showTaskDrawer} onOpenChange={setShowTaskDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingTask ? "Edit Task" : "New Task"}</SheetTitle>
            <SheetDescription>
              {editingTask ? "Update task details" : "Create a new task for this project"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <TaskForm
              task={editingTask}
              projects={[project]}
              users={users}
              onSubmit={handleTaskSubmit}
              onCancel={() => {
                setShowTaskDrawer(false);
                setEditingTask(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Time Entry Drawer */}
      <Sheet open={showTimeDrawer} onOpenChange={setShowTimeDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingTimeEntry ? "Edit Time Entry" : "New Time Entry"}</SheetTitle>
            <SheetDescription>
              {editingTimeEntry ? "Update time entry details" : "Log time for this project"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <TimeEntryForm
              timeEntry={editingTimeEntry}
              projects={[project]}
              tasks={tasks}
              teamMembers={teamMembers}
              currentTeamMember={teamMembers.find(tm => tm.user_id === currentUser?.id)} // Updated to match outline
              onSubmit={handleTimeSubmit}
              onCancel={() => {
                setShowTimeDrawer(false);
                setEditingTimeEntry(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Contact Drawer */}
      <Sheet open={showContactDrawer} onOpenChange={setShowContactDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingContact ? "Edit Contact" : "New Contact"}</SheetTitle>
            <SheetDescription>
              {editingContact ? "Update contact details" : "Add a new contact for this account"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ContactForm
              contact={editingContact}
              accounts={[account]}
              onSubmit={handleContactSubmit}
              onCancel={() => {
                setShowContactDrawer(false);
                setEditingContact(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmDialog.open} onOpenChange={(open) => setDeleteConfirmDialog({ ...deleteConfirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {deleteConfirmDialog.type}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmDialog({ open: false, type: null, id: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
