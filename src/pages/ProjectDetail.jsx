
import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Project, Account, Task, TimeEntry, Contact, Invoice, TeamMember } from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
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
  RefreshCw,
  Upload,
  File,
  Download,
  Loader2
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
import { api } from "@/api/legacyClient";
import { supabase } from "@/api/supabaseClient";

export default function ProjectDetail() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('id');
  const { user: authUser, userProfile } = useAuth();

  const [project, setProject] = useState(null);
  const [account, setAccount] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);
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

      const [accountData, tasksData, timeData, contactsData, invoicesData, teamMembersData, subscriptionsData] = await Promise.all([
        Account.list(),
        Task.filter({ project_id: projectId }),
        TimeEntry.filter({ project_id: projectId }),
        Contact.list(),
        Invoice.list(),
        TeamMember.list(),
        api.entities.StripeSubscription.list()
      ]);
      const projectAccount = accountData.find(a => a.id === currentProject.account_id);
      setAccount(projectAccount);
      setAllAccounts(accountData);
      setTasks(tasksData);
      setTimeEntries(timeData);
      setContacts(contactsData.filter(c => c.account_id === currentProject.account_id));
      setTeamMembers(teamMembersData);
      // Filter invoices that are linked to this project directly or through its time entries
      setInvoices(invoicesData.filter(inv =>
        inv.project_id === projectId || inv.time_entry_ids?.some(teId => timeData.some(te => te.id === teId))
      ));
      // Filter subscriptions that are linked to this project
      setSubscriptions(subscriptionsData.filter(sub => sub.project_id === projectId));

      // Load documents
      const { data: docsData } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      setDocuments(docsData || []);
    } catch (error) {
      console.error("Error loading project:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocument(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${projectId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(`documents/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(`documents/${fileName}`);

      const { error: dbError } = await supabase
        .from('project_documents')
        .insert({
          project_id: projectId,
          name: file.name,
          file_path: publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: authUser?.id
        });

      if (dbError) throw dbError;

      loadProjectData();
    } catch (error) {
      console.error('Error uploading document:', error);
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (docId, filePath) => {
    try {
      await supabase.from('project_documents').delete().eq('id', docId);
      setDocuments(documents.filter(d => d.id !== docId));
    } catch (error) {
      console.error('Error deleting document:', error);
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
        await TimeEntry.create({ ...timeData, project_id: projectId });
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

  const isAdmin = userProfile?.role === "admin";
  const currentTeamMember = teamMembers.find(tm => tm.user_id === authUser?.id);
  const isInternalProject = project.is_internal || project.billing_type === 'internal';

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
    expectedRevenue = project.monthly_retainer || 0;
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
      <div className="flex flex-wrap gap-4 mb-6">
        {isAdmin && !isInternalProject && (
          <>
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-500">Revenue</span>
              <span className="font-semibold text-blue-600">${timeBasedRevenue.toLocaleString()}</span>
              <span className="text-xs text-gray-400">({billableHours.toFixed(1)}h)</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-500">Billed</span>
              <span className="font-semibold text-green-600">${billedRevenue.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-sm text-gray-500">Labor</span>
              <span className="font-semibold text-red-600">${laborCost.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border">
              <DollarSign className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-500">Margin</span>
              <span className={`font-semibold ${billedRevenue - laborCost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${(billedRevenue - laborCost).toLocaleString()}
              </span>
              <span className="text-xs text-gray-400">
                ({billedRevenue > 0 ? (((billedRevenue - laborCost) / billedRevenue) * 100).toFixed(0) : 0}%)
              </span>
            </div>
          </>
        )}
        {(!isAdmin || isInternalProject) && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">Hours</span>
            <span className="font-semibold">{totalHours.toFixed(1)}h</span>
            {!isInternalProject && <span className="text-xs text-gray-400">({billableHours.toFixed(1)}h billable)</span>}
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-500">This Week</span>
          <span className="font-semibold">{weeklyHours.toFixed(1)}h</span>
          {weeklyMinimum > 0 && (
            <span className={`text-xs ${weeklyProgress >= 100 ? 'text-green-500' : 'text-gray-400'}`}>
              / {weeklyMinimum}h ({weeklyProgress.toFixed(0)}%)
            </span>
          )}
        </div>
      </div>

      {/* Additional Metrics for Retainer - Admin Only (not for internal projects) */}
      {isAdmin && !isInternalProject && project.billing_type === "retainer" && project.monthly_retainer && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Retainer Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Monthly Retainer</p>
                <p className="text-2xl font-bold text-gray-900">${project.monthly_retainer.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Labor Cost (This Month)</p>
                <p className="text-2xl font-bold text-red-600">${laborCost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Retainer Value</p>
                <p className={`text-2xl font-bold ${laborCost <= project.monthly_retainer ? 'text-green-600' : 'text-red-600'}`}>
                  {laborCost <= project.monthly_retainer ? 'Under' : 'Over'} Budget
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ${Math.abs(project.monthly_retainer - laborCost).toLocaleString()} {laborCost <= project.monthly_retainer ? 'remaining' : 'over'}
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
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="time">Time</TabsTrigger>
          {isAdmin && <TabsTrigger value="reports">Reports</TabsTrigger>}
          {!isInternalProject && <TabsTrigger value="contacts">Contacts</TabsTrigger>}
          {!isInternalProject && <TabsTrigger value="billing">Billing</TabsTrigger>}
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          {/* Billing Type Overview - Compact inline stats (not for internal projects) */}
          {!isInternalProject && project.billing_type === 'exit' && (
            <div className="flex flex-wrap gap-3 p-3 bg-white rounded-lg border">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" /> Exit
              </span>
              <span className="text-sm text-gray-600">Baseline: <span className="font-semibold">${(project.baseline_valuation || 0).toLocaleString()}</span></span>
              <span className="text-sm text-gray-600">Fee: <span className="font-semibold text-green-600">{project.valuation_percentage || 8}%</span></span>
              <span className="text-sm text-gray-600">Retainer: <span className="font-semibold">${(project.monthly_retainer || 0).toLocaleString()}/mo</span></span>
              <span className="text-sm text-gray-600">Target: <span className="font-semibold">{project.exit_target_date ? new Date(project.exit_target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Not set'}</span></span>
            </div>
          )}

          {!isInternalProject && project.billing_type === 'retainer' && (
            <div className="flex flex-wrap gap-3 p-3 bg-white rounded-lg border">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Users className="w-4 h-4" /> Retainer
              </span>
              <span className="text-sm text-gray-600">Monthly: <span className="font-semibold">${(project.monthly_retainer || 0).toLocaleString()}</span></span>
              <span className="text-sm text-gray-600">Hours: <span className="font-semibold text-purple-600">{project.retainer_hours_included || project.budget_hours || 0}h</span>/mo</span>
              <span className="text-sm text-gray-600">Used: <span className="font-semibold">{currentMonthHours.toFixed(1)}h</span></span>
              <span className={`text-sm ${hoursRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {hoursRemaining >= 0 ? `${hoursRemaining.toFixed(1)}h left` : `${Math.abs(hoursRemaining).toFixed(1)}h over`}
              </span>
            </div>
          )}

          {!isInternalProject && project.billing_type === 'hourly' && (
            <div className="flex flex-wrap gap-3 p-3 bg-white rounded-lg border">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Clock className="w-4 h-4" /> Hourly
              </span>
              <span className="text-sm text-gray-600">Rate: <span className="font-semibold">${(project.hourly_rate || 0).toLocaleString()}/hr</span></span>
              <span className="text-sm text-gray-600">Billable: <span className="font-semibold text-blue-600">{billableHours.toFixed(1)}h</span></span>
              <span className="text-sm text-gray-600">Revenue: <span className="font-semibold text-green-600">${(billableHours * (project.hourly_rate || 0)).toLocaleString()}</span></span>
              {(billableHours - billedHours) > 0 && (
                <span className="text-sm text-gray-600">Unbilled: <span className="font-semibold text-orange-600">${((billableHours - billedHours) * (project.hourly_rate || 0)).toLocaleString()}</span></span>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className={`grid grid-cols-1 ${!isInternalProject ? 'md:grid-cols-2' : ''} gap-6`}>
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input
                    value={editedProject?.name || ''}
                    onChange={(e) => handleProjectFieldChange('name', e.target.value)}
                  />
                </div>
                {!isInternalProject && (
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
                )}
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
                      <SelectItem value="exit_systematization">Exit Systematization</SelectItem>
                      <SelectItem value="web_development">Web Development</SelectItem>
                      <SelectItem value="consulting">Consulting</SelectItem>
                      <SelectItem value="automation">Automation</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isAdmin && (
                <>
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">{isInternalProject ? 'Budget' : 'Budget & Billing'}</h3>

                    {/* Billing fields - only for client projects */}
                    {!isInternalProject && (
                      <>
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
                                <SelectItem value="retainer">Retainer</SelectItem>
                                <SelectItem value="exit">Exit (Retainer + Success Fee)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {editedProject?.billing_type === 'hourly' && (
                            <div className="space-y-2">
                              <Label>Hourly Rate ($)</Label>
                              <Input
                                type="number"
                                value={editedProject?.hourly_rate || ''}
                                onChange={(e) => handleProjectFieldChange('hourly_rate', parseFloat(e.target.value) || 0)}
                                placeholder="150.00"
                              />
                            </div>
                          )}
                        </div>

                        {/* Retainer-specific fields */}
                        {editedProject?.billing_type === 'retainer' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div className="space-y-2">
                              <Label>Monthly Retainer ($)</Label>
                              <Input
                                type="number"
                                value={editedProject?.monthly_retainer || ''}
                                onChange={(e) => handleProjectFieldChange('monthly_retainer', parseFloat(e.target.value) || 0)}
                                placeholder="2500.00"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Hours Included (per month)</Label>
                              <Input
                                type="number"
                                value={editedProject?.retainer_hours_included || ''}
                                onChange={(e) => handleProjectFieldChange('retainer_hours_included', parseFloat(e.target.value) || 0)}
                                placeholder="20"
                              />
                            </div>
                          </div>
                        )}

                        {/* Exit-specific fields */}
                        {editedProject?.billing_type === 'exit' && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                              <div className="space-y-2">
                                <Label>Monthly Retainer ($)</Label>
                                <Input
                                  type="number"
                                  value={editedProject?.monthly_retainer || ''}
                                  onChange={(e) => handleProjectFieldChange('monthly_retainer', parseFloat(e.target.value) || 0)}
                                  placeholder="2500.00"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Success Fee (%)</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={editedProject?.valuation_percentage || ''}
                                  onChange={(e) => handleProjectFieldChange('valuation_percentage', parseFloat(e.target.value) || 0)}
                                  placeholder="8"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                              <div className="space-y-2">
                                <Label>Baseline Valuation ($)</Label>
                                <Input
                                  type="number"
                                  value={editedProject?.baseline_valuation || ''}
                                  onChange={(e) => handleProjectFieldChange('baseline_valuation', parseFloat(e.target.value) || 0)}
                                  placeholder="2000000"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Engagement Length (months)</Label>
                                <Select
                                  value={String(editedProject?.engagement_months || 3)}
                                  onValueChange={(value) => handleProjectFieldChange('engagement_months', parseInt(value))}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1 month</SelectItem>
                                    <SelectItem value="2">2 months</SelectItem>
                                    <SelectItem value="3">3 months</SelectItem>
                                    <SelectItem value="6">6 months</SelectItem>
                                    <SelectItem value="12">12 months</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                              <div className="space-y-2">
                                <Label>Exit Target Date</Label>
                                <Input
                                  type="date"
                                  value={editedProject?.exit_target_date || ''}
                                  onChange={(e) => handleProjectFieldChange('exit_target_date', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Success Fee Status</Label>
                                <Select
                                  value={editedProject?.success_fee_status || 'pending'}
                                  onValueChange={(value) => handleProjectFieldChange('success_fee_status', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="waived">Waived (Guarantee)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* Budget fields - for all projects */}
                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${!isInternalProject ? 'mt-4' : ''}`}>
                      <div className="space-y-2">
                        <Label>Budget Hours {!isInternalProject && editedProject?.billing_type === 'retainer' ? '(Monthly)' : ''}</Label>
                        <Input
                          type="number"
                          value={editedProject?.budget_hours || ''}
                          onChange={(e) => handleProjectFieldChange('budget_hours', parseFloat(e.target.value) || 0)}
                          placeholder="100"
                        />
                      </div>
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

        <TabsContent value="time" className="space-y-6">
          {/* Time Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Total Hours</div>
                <div className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}h</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">This Month</div>
                <div className="text-2xl font-bold text-indigo-600">{currentMonthHours.toFixed(1)}h</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">
                  {project?.billing_type === 'hourly' ? 'Billable' : 'Tracked'}
                </div>
                <div className="text-2xl font-bold text-green-600">{billableHours.toFixed(1)}h</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Entries</div>
                <div className="text-2xl font-bold text-gray-600">{timeEntries.length}</div>
              </CardContent>
            </Card>
          </div>

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
                Log Time
              </Button>
            </CardHeader>
            <CardContent>
              {timeEntries.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No time logged yet</h3>
                  <p className="text-gray-500">Start tracking time for this project</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Team Member</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                        <TableCell>{getTeamMemberNameById(entry.team_member_id)}</TableCell>
                        <TableCell className="max-w-xs truncate">{entry.description || '—'}</TableCell>
                        <TableCell className="font-medium">{entry.hours}h</TableCell>
                        <TableCell>
                          {project?.billing_type === 'retainer' || project?.billing_type === 'exit' ? (
                            <Badge className="bg-purple-100 text-purple-700">Retainer</Badge>
                          ) : entry.billable ? (
                            <Badge className="bg-green-100 text-green-700">Billable</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-700">Non-billable</Badge>
                          )}
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
                              onClick={() => {
                                const canDelete = isAdmin || entry.team_member_id === currentTeamMember?.id;
                                if (canDelete) {
                                  setDeleteConfirmDialog({ open: true, type: 'time', id: entry.id });
                                } else {
                                  alert("You can only delete your own time entries. Ask an admin to delete this entry.");
                                }
                              }}
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

        <TabsContent value="billing" className="space-y-6">
          {/* Billing Summary based on project type */}
          {project && (
            <Card className="bg-gray-50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-gray-600">Billing Type</p>
                    <p className="text-lg font-semibold capitalize">{project.billing_type}</p>
                  </div>
                  {project.billing_type === 'hourly' && (
                    <>
                      <div>
                        <p className="text-sm text-gray-600">Hourly Rate</p>
                        <p className="text-lg font-semibold">${project.hourly_rate || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Billable Value</p>
                        <p className="text-lg font-semibold text-green-600">
                          ${(billableHours * (project.hourly_rate || 0)).toLocaleString()}
                        </p>
                      </div>
                    </>
                  )}
                  {(project.billing_type === 'retainer' || project.billing_type === 'exit') && (
                    <>
                      <div>
                        <p className="text-sm text-gray-600">Monthly Retainer</p>
                        <p className="text-lg font-semibold">${(project.monthly_retainer || 0).toLocaleString()}</p>
                      </div>
                      {project.billing_type === 'exit' && (
                        <div>
                          <p className="text-sm text-gray-600">Success Fee</p>
                          <p className="text-lg font-semibold">{project.valuation_percentage || 8}%</p>
                        </div>
                      )}
                    </>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Invoices</p>
                    <p className="text-lg font-semibold">{invoices.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invoices */}
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No invoices yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
                        </TableCell>
                        <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-semibold">${(invoice.total || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={
                            invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                            invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Subscriptions */}
          {subscriptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.product_name || 'Subscription'}</TableCell>
                        <TableCell>${(sub.amount || 0).toLocaleString()}/{sub.interval || 'month'}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={sub.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {sub.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <File className="w-5 h-5" />
                Project Documents
              </CardTitle>
              <div>
                <input
                  type="file"
                  id="document-upload"
                  className="hidden"
                  onChange={handleDocumentUpload}
                />
                <Button
                  size="sm"
                  onClick={() => document.getElementById('document-upload').click()}
                  disabled={uploadingDocument}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {uploadingDocument ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Document
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-12">
                  <File className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents yet</h3>
                  <p className="text-gray-500 mb-4">Upload contracts, proposals, and other project files</p>
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('document-upload').click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload First Document
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{doc.name}</h4>
                          <p className="text-xs text-gray-500">
                            {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''}
                            {doc.created_at && ` • Uploaded ${new Date(doc.created_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={doc.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc.id, doc.file_path)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ticket API Tab */}
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
    "created_at": "2025-01-15T10:30:00Z"
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
              teamMembers={teamMembers}
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
              currentTeamMember={currentTeamMember}
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
