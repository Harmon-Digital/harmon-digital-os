
import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Project, Account, Task, TimeEntry, Contact, Invoice, TeamMember } from "@/api/entities";
import { parseLocalDate } from "@/utils";
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
  Loader2,
  Filter,
  Search,
  Briefcase,
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
import FormShell from "@/components/ui/FormShell";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [phases, setPhases] = useState([]);
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

  // Task filters
  const [taskStatusFilter, setTaskStatusFilter] = useState("active");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("all");
  const [taskSearch, setTaskSearch] = useState("");

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

      const [accountData, tasksData, timeData, contactsData, invoicesData, teamMembersData, subscriptionsData] = await Promise.allSettled([
        Account.list(),
        Task.filter({ project_id: projectId }),
        TimeEntry.filter({ project_id: projectId }),
        Contact.list(),
        Invoice.list(),
        TeamMember.list(),
        api.entities.StripeSubscription.list()
      ]).then(results => results.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        console.error(`ProjectDetail data load [${i}] failed:`, r.reason);
        return [];
      }));
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

      // Load phases
      const { data: phasesData } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });
      setPhases(phasesData || []);
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
      const { error } = await supabase.from('project_documents').delete().eq('id', docId);
      if (error) throw error;
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Project not found</h2>
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
      const entryDate = parseLocalDate(entry.date);
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
        const entryDate = parseLocalDate(entry.date);
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

  // Calculate labor costs for current month only (team member hourly rates × hours worked)
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const laborCost = timeEntries
    .filter(entry => parseLocalDate(entry.date) >= currentMonthStart)
    .reduce((sum, entry) => {
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
    expectedRevenue = project.total_budget || project.budget || 0;
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
    .filter(entry => parseLocalDate(entry.date) >= oneWeekAgo)
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
    blocked: tasks.filter(t => t.status === 'blocked').length,
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
    <div className="px-4 lg:px-6 py-4">
      <style>{`
        .project-detail-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        .project-detail-form textarea,
        .project-detail-form [role="combobox"] {
          border-color: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          transition: background-color 0.12s ease, border-color 0.12s ease;
        }
        .project-detail-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):hover,
        .project-detail-form textarea:hover,
        .project-detail-form [role="combobox"]:hover {
          background-color: rgb(249 250 251) !important;
        }
        .project-detail-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus,
        .project-detail-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus-visible,
        .project-detail-form textarea:focus,
        .project-detail-form textarea:focus-visible,
        .project-detail-form [role="combobox"]:focus,
        .project-detail-form [role="combobox"][data-state="open"] {
          background-color: white !important;
          border-color: rgb(199 210 254) !important;
          box-shadow: 0 0 0 3px rgb(224 231 255 / 0.45) !important;
          outline: none !important;
        }
        /* Tighten the card chrome inside Details — less shadow, softer border */
        .project-detail-form .rounded-lg.border.shadow-sm,
        .project-detail-form [class*="rounded-lg"][class*="border"][class*="shadow"] {
          box-shadow: none !important;
          border-color: rgb(229 231 235) !important;
        }
        /* Label styling: smaller, softer */
        .project-detail-form label {
          font-size: 12px !important;
          font-weight: 500 !important;
          color: rgb(107 114 128) !important;
        }
      `}</style>
      {/* Compact header */}
      <div className="flex items-center gap-3 mb-4 text-[13px]">
        <Link
          to={createPageUrl("Projects")}
          className="inline-flex items-center text-gray-500 hover:text-gray-900 dark:text-gray-100 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Projects
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        {account?.logo_url ? (
          <img src={account.logo_url} alt="" className="w-5 h-5 rounded object-contain bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shrink-0" />
        ) : (
          <Users className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
        )}
        {account?.company_name && (
          <span className="text-gray-500 truncate">{account.company_name}</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate">{project.name}</h1>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`${statusColors[project.status]} capitalize text-[11px]`}>
            {project.status.replace('_', ' ')}
          </Badge>
          <Badge className={`${riskColors[project.risk_level || 'low']} text-[11px]`}>
            {(project.risk_level || 'low').toUpperCase()} risk
          </Badge>
        </div>
      </div>

      {/* Unified stats strip — inline metric pills, no card chrome */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-[13px]">
        {isAdmin && !isInternalProject && (
          <>
            <span className="inline-flex items-baseline gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-500 self-center" />
              <span className="text-gray-500">Revenue</span>
              <span className="font-semibold text-blue-600">${timeBasedRevenue.toLocaleString()}</span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">· {billableHours.toFixed(1)}h</span>
            </span>
            <span className="inline-flex items-baseline gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-500 self-center" />
              <span className="text-gray-500">Billed</span>
              <span className="font-semibold text-green-600">${billedRevenue.toLocaleString()}</span>
            </span>
            <span className="inline-flex items-baseline gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-red-500 self-center" />
              <span className="text-gray-500">Labor</span>
              <span className="font-semibold text-red-600">${laborCost.toLocaleString()}</span>
            </span>
            <span className="inline-flex items-baseline gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-gray-500 self-center" />
              <span className="text-gray-500">Margin</span>
              <span className={`font-semibold ${billedRevenue - laborCost >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${(billedRevenue - laborCost).toLocaleString()}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                · {billedRevenue > 0 ? (((billedRevenue - laborCost) / billedRevenue) * 100).toFixed(0) : 0}%
              </span>
            </span>
          </>
        )}
        {(!isAdmin || isInternalProject) && (
          <span className="inline-flex items-baseline gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-500 self-center" />
            <span className="text-gray-500">Hours</span>
            <span className="font-semibold">{totalHours.toFixed(1)}h</span>
            {!isInternalProject && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">· {billableHours.toFixed(1)}h billable</span>
            )}
          </span>
        )}
        <span className="inline-flex items-baseline gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-500 self-center" />
          <span className="text-gray-500">This Week</span>
          <span className="font-semibold">{weeklyHours.toFixed(1)}h</span>
          {weeklyMinimum > 0 && (
            <span className={`text-[11px] ${weeklyProgress >= 100 ? "text-green-500" : "text-gray-400 dark:text-gray-500"}`}>
              · {weeklyProgress.toFixed(0)}% of {weeklyMinimum}h
            </span>
          )}
        </span>
      </div>

      {/* Slim hours budget progress — borderless */}
      {budgetHours > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-[12px] mb-1.5">
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              {isRetainer ? `Retainer · ${currentMonth}` : "Hours budget"}
              <span className="ml-2 text-gray-400 dark:text-gray-500 font-normal">
                {isRetainer
                  ? `${currentMonthHours.toFixed(1)} / ${monthlyBudget}h this month`
                  : `${totalHours.toFixed(1)} / ${budgetHours}h total`}
              </span>
            </span>
            <span
              className={`tabular-nums ${hoursRemaining < 0 ? "text-red-600 font-semibold" : "text-gray-500"}`}
            >
              {hoursRemaining >= 0
                ? `${hoursRemaining.toFixed(1)}h remaining · ${completionPercentage.toFixed(0)}%`
                : `${Math.abs(hoursRemaining).toFixed(1)}h over · ${completionPercentage.toFixed(0)}%`}
            </span>
          </div>
          <Progress
            value={completionPercentage}
            className="h-2"
            indicatorClassName={getProgressColor()}
          />
          {isRetainer && monthlyHistory.length > 0 && (
            <details className="mt-3">
              <summary className="text-[12px] text-gray-500 hover:text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                Last 6 months
              </summary>
              <div className="mt-2 space-y-1.5 pl-3 border-l border-gray-100 dark:border-gray-800">
                {monthlyHistory.map((month, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-gray-600 dark:text-gray-400">{month.label}</span>
                      <span className={month.isOverBudget ? "text-red-600 font-semibold" : "text-gray-900 dark:text-gray-100"}>
                        {month.hours.toFixed(1)}h / {month.budget}h
                        {month.isOverBudget && ` (+${(month.hours - month.budget).toFixed(1)}h)`}
                      </span>
                    </div>
                    <div className="relative h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`absolute top-0 left-0 h-full transition-all ${
                          month.hours >= month.budget
                            ? "bg-red-500"
                            : month.hours >= month.budget * 0.8
                              ? "bg-yellow-500"
                              : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min((month.hours / month.budget) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Linear-style tabs: thin underlined row */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className="h-9 bg-transparent p-0 border-b border-gray-200 dark:border-gray-800 rounded-none w-full justify-start gap-5 px-1">
          {[
            { v: "details", label: "Details" },
            { v: "tasks", label: "Tasks" },
            { v: "time", label: "Time" },
            ...(isAdmin ? [{ v: "reports", label: "Reports" }] : []),
            ...(!isInternalProject ? [{ v: "contacts", label: "Contacts" }] : []),
            ...(!isInternalProject ? [{ v: "billing", label: "Billing" }] : []),
            { v: "documents", label: "Documents" },
            { v: "api", label: "API" },
          ].map(t => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="relative h-9 px-0 text-[13px] font-medium text-gray-500 rounded-none bg-transparent shadow-none data-[state=active]:text-gray-900 dark:text-gray-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-transparent data-[state=active]:after:bg-gray-900"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="details" className="space-y-6 project-detail-form">
          {/* Billing Type Overview - Compact inline stats (not for internal projects) */}
          {!isInternalProject && project.billing_type === 'exit' && (
            <div className="flex flex-wrap gap-3 p-3 bg-white dark:bg-gray-950 rounded-lg border">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" /> Exit
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Baseline: <span className="font-semibold">${(project.baseline_valuation || 0).toLocaleString()}</span></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Fee: <span className="font-semibold text-green-600">{project.valuation_percentage || 8}%</span></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Retainer: <span className="font-semibold">${(project.monthly_retainer || 0).toLocaleString()}/mo</span></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Target: <span className="font-semibold">{project.exit_target_date ? new Date(project.exit_target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Not set'}</span></span>
            </div>
          )}

          {!isInternalProject && project.billing_type === 'retainer' && (
            <div className="flex flex-wrap gap-3 p-3 bg-white dark:bg-gray-950 rounded-lg border">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Users className="w-4 h-4" /> Retainer
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Monthly: <span className="font-semibold">${(project.monthly_retainer || 0).toLocaleString()}</span></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Hours: <span className="font-semibold text-purple-600">{project.retainer_hours_included || project.budget_hours || 0}h</span>/mo</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Used: <span className="font-semibold">{currentMonthHours.toFixed(1)}h</span></span>
              <span className={`text-sm ${hoursRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {hoursRemaining >= 0 ? `${hoursRemaining.toFixed(1)}h left` : `${Math.abs(hoursRemaining).toFixed(1)}h over`}
              </span>
            </div>
          )}

          {!isInternalProject && project.billing_type === 'hourly' && (
            <div className="flex flex-wrap gap-3 p-3 bg-white dark:bg-gray-950 rounded-lg border">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Clock className="w-4 h-4" /> Hourly
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Rate: <span className="font-semibold">${(project.hourly_rate || 0).toLocaleString()}/hr</span></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Billable: <span className="font-semibold text-blue-600">{billableHours.toFixed(1)}h</span></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Revenue: <span className="font-semibold text-green-600">${(billableHours * (project.hourly_rate || 0)).toLocaleString()}</span></span>
              {(billableHours - billedHours) > 0 && (
                <span className="text-sm text-gray-600 dark:text-gray-400">Unbilled: <span className="font-semibold text-orange-600">${((billableHours - billedHours) * (project.hourly_rate || 0)).toLocaleString()}</span></span>
              )}
            </div>
          )}

          {!isInternalProject && project.billing_type === 'fixed' && (() => {
            const totalBudget = Number(project.total_budget || project.budget || 0);
            const phasesTotal = phases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const completedTotal = phases
              .filter((p) => ['completed', 'invoiced', 'paid'].includes(p.status))
              .reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const paidTotal = phases
              .filter((p) => p.status === 'paid')
              .reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const pct = phasesTotal > 0 ? (completedTotal / phasesTotal) * 100 : 0;
            const PHASE_DOT = {
              planned: 'bg-gray-400',
              in_progress: 'bg-blue-500',
              completed: 'bg-green-500',
              invoiced: 'bg-amber-500',
              paid: 'bg-emerald-600',
              cancelled: 'bg-red-500',
            };
            return (
              <div className="p-3 bg-white dark:bg-gray-950 rounded-lg border space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <Briefcase className="w-4 h-4" /> Fixed project
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Budget <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">${totalBudget.toLocaleString()}</span>
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Phases total <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">${phasesTotal.toLocaleString()}</span>
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Delivered <span className="font-semibold text-green-600 tabular-nums">${completedTotal.toLocaleString()}</span>
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Paid <span className="font-semibold text-emerald-600 tabular-nums">${paidTotal.toLocaleString()}</span>
                  </span>
                  <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                    {phases.length} {phases.length === 1 ? 'phase' : 'phases'} · {pct.toFixed(0)}% complete
                  </span>
                </div>

                {/* Progress bar */}
                {phasesTotal > 0 && (
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                )}

                {/* Phases list */}
                {phases.length > 0 ? (
                  <div className="border-t border-gray-100 dark:border-gray-800 -mx-3 -mb-3">
                    {phases.map((ph, i) => (
                      <div
                        key={ph.id}
                        className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                      >
                        <span className="text-[11px] text-gray-400 tabular-nums w-4 text-right flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PHASE_DOT[ph.status] || 'bg-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-gray-900 dark:text-gray-100 truncate">{ph.name}</div>
                          {ph.description && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{ph.description}</div>
                          )}
                        </div>
                        {ph.end_date && (
                          <span className="hidden md:inline text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                            due {new Date(ph.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        <span className="text-[11px] capitalize text-gray-500 dark:text-gray-400 w-20 text-right">
                          {ph.status?.replace('_', ' ')}
                        </span>
                        <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium tabular-nums w-20 text-right">
                          ${Number(ph.amount || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[12px] text-gray-400 dark:text-gray-500 italic">
                    No phases yet. Open the project edit form to break this into milestones.
                  </div>
                )}
              </div>
            );
          })()}

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

        <TabsContent value="tasks" className="space-y-3">
          {/* Toolbar: status segments + search + filter + new task */}
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5 text-[12px]">
              {[
                { id: "active", label: "Active" },
                { id: "all", label: "All" },
                { id: "completed", label: "Done" },
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTaskStatusFilter(s.id)}
                  className={`px-2 py-0.5 rounded ${taskStatusFilter === s.id ? "bg-gray-900 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-xs min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5" />
              <Input
                placeholder="Search tasks"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="pl-7 h-7 text-[13px] border-gray-200 dark:border-gray-800 focus-visible:ring-1"
              />
            </div>
            {(() => {
              const fc = (taskPriorityFilter !== "all" ? 1 : 0) + (taskAssigneeFilter !== "all" ? 1 : 0);
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="shrink-0 gap-1.5 h-7 text-[12px]">
                      <Filter className="w-3 h-3" />
                      Filter
                      {fc > 0 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-900 text-white text-[10px] font-semibold">{fc}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold">Filters</span>
                      {fc > 0 && (
                        <button type="button" className="text-[12px] text-gray-500 hover:text-gray-900 dark:text-gray-100" onClick={() => { setTaskPriorityFilter("all"); setTaskAssigneeFilter("all"); }}>
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-gray-500">Priority</label>
                      <Select value={taskPriorityFilter} onValueChange={setTaskPriorityFilter}>
                        <SelectTrigger className="h-7 text-[13px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-gray-500">Assignee</label>
                      <Select value={taskAssigneeFilter} onValueChange={setTaskAssigneeFilter}>
                        <SelectTrigger className="h-7 text-[13px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {teamMembers.filter(tm => tm.status === 'active').map(tm => (
                            <SelectItem key={tm.id} value={tm.id}>{tm.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })()}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setEditingTask(null); setShowTaskDrawer(true); }}
              className="h-7 px-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New task
            </Button>
          </div>

          {/* Dense filtered list */}
          <div className="border-t border-gray-200 dark:border-gray-800">
            {(() => {
              const filtered = tasks.filter(task => {
                if (taskStatusFilter === "active" && task.status === "completed") return false;
                if (taskStatusFilter === "completed" && task.status !== "completed") return false;
                if (taskPriorityFilter !== "all" && task.priority !== taskPriorityFilter) return false;
                if (taskAssigneeFilter !== "all" && task.assigned_to !== taskAssigneeFilter) return false;
                if (taskSearch) {
                  const q = taskSearch.toLowerCase();
                  if (!task.title?.toLowerCase().includes(q) && !(task.description || "").toLowerCase().includes(q)) return false;
                }
                return true;
              });
              if (filtered.length === 0) {
                return <div className="py-10 text-center text-[13px] text-gray-500">{tasks.length === 0 ? "No tasks yet" : "No matching tasks"}</div>;
              }
              return filtered.map(task => {
                const statusDot =
                  task.status === 'completed' ? 'bg-green-500' :
                  task.status === 'in_progress' ? 'bg-blue-500' :
                  task.status === 'blocked' ? 'bg-red-500' :
                  task.status === 'review' ? 'bg-yellow-500' : 'bg-gray-300';
                const priorityColor =
                  task.priority === 'urgent' ? 'text-red-600' :
                  task.priority === 'high' ? 'text-orange-600' :
                  task.priority === 'low' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400';
                return (
                  <div
                    key={task.id}
                    className="group flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer"
                    onClick={() => { setEditingTask(task); setShowTaskDrawer(true); }}
                  >
                    <span className={`w-2 h-2 rounded-full ${statusDot} flex-shrink-0`} />
                    <span className="flex-1 text-[13px] text-gray-900 dark:text-gray-100 truncate">{task.title}</span>
                    <span className={`text-[11px] capitalize ${priorityColor} w-14 text-right`}>{task.priority}</span>
                    <span className="text-[12px] text-gray-500 w-28 truncate text-right">{getUserName(task.assigned_to) || '—'}</span>
                    <span className="text-[12px] text-gray-500 w-20 text-right">
                      {task.due_date ? parseLocalDate(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmDialog({ open: true, type: 'task', id: task.id }); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </TabsContent>

        <TabsContent value="time" className="space-y-3">
          {/* Inline metric strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
            <span>Total <span className="text-gray-900 dark:text-gray-100 font-medium">{totalHours.toFixed(1)}h</span></span>
            <span>This month <span className="text-gray-900 dark:text-gray-100 font-medium">{currentMonthHours.toFixed(1)}h</span></span>
            <span>{project?.billing_type === 'hourly' ? 'Billable' : 'Tracked'} <span className="text-gray-900 dark:text-gray-100 font-medium">{billableHours.toFixed(1)}h</span></span>
            <span>Entries <span className="text-gray-900 dark:text-gray-100 font-medium">{timeEntries.length}</span></span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setEditingTimeEntry(null); setShowTimeDrawer(true); }}
              className="h-7 px-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Log time
            </Button>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800">
            {timeEntries.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-gray-500">No time logged yet</div>
            ) : (
              timeEntries.map(entry => {
                const isRetainer = project?.billing_type === 'retainer' || project?.billing_type === 'exit';
                const typeLabel = isRetainer ? 'Retainer' : entry.billable ? 'Billable' : 'Non-billable';
                const typeColor = isRetainer ? 'text-purple-600' : entry.billable ? 'text-green-600' : 'text-gray-500';
                return (
                  <div
                    key={entry.id}
                    className="group flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer"
                    onClick={() => { setEditingTimeEntry(entry); setShowTimeDrawer(true); }}
                  >
                    <span className="text-[12px] text-gray-500 w-20">
                      {parseLocalDate(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[13px] text-gray-900 dark:text-gray-100 w-32 truncate">{getTeamMemberNameById(entry.team_member_id)}</span>
                    <span className="flex-1 text-[13px] text-gray-600 dark:text-gray-400 truncate">{entry.description || '—'}</span>
                    <span className={`text-[12px] ${typeColor} w-24 text-right`}>{typeLabel}</span>
                    <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium w-12 text-right">{entry.hours}h</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const canDelete = isAdmin || entry.team_member_id === currentTeamMember?.id;
                        if (canDelete) setDeleteConfirmDialog({ open: true, type: 'time', id: entry.id });
                        else alert("You can only delete your own time entries.");
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
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

        <TabsContent value="contacts" className="space-y-3">
          <div className="flex items-center text-[13px] text-gray-600 dark:text-gray-400">
            <span>{contacts.length} contact{contacts.length === 1 ? '' : 's'}</span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setEditingContact(null); setShowContactDrawer(true); }}
              className="h-7 px-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New contact
            </Button>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800">
            {contacts.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-gray-500">
                No contacts yet. Click "New contact" to add one.
              </div>
            ) : (
              contacts.map(contact => {
                const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();
                const roleColor =
                  contact.role === 'primary' ? 'text-indigo-600 dark:text-indigo-400' :
                  contact.role === 'billing' ? 'text-green-600 dark:text-green-400' :
                  contact.role === 'technical' ? 'text-blue-600 dark:text-blue-400' :
                  'text-gray-500 dark:text-gray-400';
                return (
                  <div
                    key={contact.id}
                    className="group flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer"
                    onClick={() => { setEditingContact(contact); setShowContactDrawer(true); }}
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center text-[11px] font-medium flex-shrink-0">
                      {initials || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium truncate">
                          {contact.first_name} {contact.last_name}
                        </span>
                        {contact.portal_user_id && (
                          <span
                            title="Has client portal access"
                            className="inline-flex items-center gap-0.5 text-[10px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded shrink-0"
                          >
                            <Check className="w-2.5 h-2.5" />
                            Portal
                          </span>
                        )}
                      </div>
                      {contact.title && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{contact.title}</div>
                      )}
                    </div>
                    <a
                      href={`mailto:${contact.email}`}
                      className="hidden md:inline text-[12px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 w-52 truncate text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contact.email}
                    </a>
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="hidden lg:inline text-[12px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 w-28 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contact.phone}
                      </a>
                    ) : (
                      <span className="hidden lg:inline text-[12px] text-gray-300 dark:text-gray-600 w-28 text-right">—</span>
                    )}
                    <span className={`text-[11px] capitalize w-20 text-right ${roleColor}`}>
                      {contact.role || '—'}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmDialog({ open: true, type: 'contact', id: contact.id });
                        }}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600"
                        title="Delete contact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-5">
          {/* Inline billing metric strip */}
          {project && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
              <span>Type <span className="text-gray-900 dark:text-gray-100 font-medium capitalize">{project.billing_type}</span></span>
              {project.billing_type === 'hourly' && (
                <>
                  <span>Rate <span className="text-gray-900 dark:text-gray-100 font-medium">${project.hourly_rate || 0}/hr</span></span>
                  <span>Billable <span className="text-gray-900 dark:text-gray-100 font-medium">${(billableHours * (project.hourly_rate || 0)).toLocaleString()}</span></span>
                </>
              )}
              {(project.billing_type === 'retainer' || project.billing_type === 'exit') && (
                <span>Retainer <span className="text-gray-900 dark:text-gray-100 font-medium">${(project.monthly_retainer || 0).toLocaleString()}/mo</span></span>
              )}
              {project.billing_type === 'exit' && (
                <span>Success fee <span className="text-gray-900 dark:text-gray-100 font-medium">{project.valuation_percentage || 8}%</span></span>
              )}
              <span>Invoices <span className="text-gray-900 dark:text-gray-100 font-medium">{invoices.length}</span></span>
            </div>
          )}

          {/* Invoices section */}
          <div>
            <div className="flex items-center h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500">Invoices</div>
            <div className="border-t border-gray-200 dark:border-gray-800">
              {invoices.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-gray-500">No invoices yet</div>
              ) : (
                invoices.map(invoice => {
                  const statusColor =
                    invoice.status === 'paid' ? 'text-green-600' :
                    invoice.status === 'sent' ? 'text-blue-600' :
                    invoice.status === 'overdue' ? 'text-red-600' : 'text-gray-500';
                  return (
                    <div key={invoice.id} className="flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <span className="flex-1 text-[13px] text-gray-900 dark:text-gray-100 truncate">
                        {invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
                      </span>
                      <span className="text-[12px] text-gray-500 w-24 text-right">
                        {invoice.due_date ? parseLocalDate(invoice.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </span>
                      <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium w-24 text-right">
                        ${(invoice.total || 0).toLocaleString()}
                      </span>
                      <span className={`text-[11px] capitalize ${statusColor} w-20 text-right`}>{invoice.status}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Subscriptions section */}
          {subscriptions.length > 0 && (
            <div>
              <div className="flex items-center h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500">Active subscriptions</div>
              <div className="border-t border-gray-200 dark:border-gray-800">
                {subscriptions.map(sub => (
                  <div key={sub.id} className="flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <span className="flex-1 text-[13px] text-gray-900 dark:text-gray-100 truncate">{sub.product_name || 'Subscription'}</span>
                    <span className="text-[13px] text-gray-900 dark:text-gray-100 w-28 text-right">
                      ${(sub.amount || 0).toLocaleString()}/{sub.interval || 'month'}
                    </span>
                    <span className="text-[12px] text-gray-500 w-24 text-right">
                      {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                    </span>
                    <span className={`text-[11px] capitalize w-16 text-right ${sub.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                      {sub.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-3">
          <input
            type="file"
            id="document-upload"
            className="hidden"
            onChange={handleDocumentUpload}
          />
          <div className="flex items-center text-[13px] text-gray-600 dark:text-gray-400">
            <span>{documents.length} file{documents.length === 1 ? '' : 's'}</span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => document.getElementById('document-upload').click()}
              disabled={uploadingDocument}
              className="h-7 px-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {uploadingDocument ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Uploading</>
              ) : (
                <><Upload className="w-3.5 h-3.5 mr-1" /> Upload</>
              )}
            </Button>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800">
            {documents.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-gray-500">
                No documents yet. Upload contracts, proposals, and other project files.
              </div>
            ) : (
              documents.map(doc => (
                <div key={doc.id} className="group flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                  <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span className="flex-1 text-[13px] text-gray-900 dark:text-gray-100 truncate">{doc.name}</span>
                  <span className="text-[12px] text-gray-500 w-20 text-right">
                    {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : '—'}
                  </span>
                  <span className="text-[12px] text-gray-500 w-24 text-right">
                    {doc.created_at ? new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <a
                      href={doc.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleDeleteDocument(doc.id, doc.file_path)}
                      className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Ticket API Tab */}
        <TabsContent value="api" className="space-y-5 max-w-3xl">
          <div className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400">
            <Ticket className="w-4 h-4" />
            <span>Create tickets from Zapier, Make, Typeform, or any webhook.</span>
          </div>

          {!project.api_key ? (
            <div className="py-10 text-center border-t border-gray-200 dark:border-gray-800">
              <p className="text-[13px] text-gray-500 mb-3">No API key generated yet</p>
              <Button onClick={generateApiKey} size="sm" className="bg-gray-900 hover:bg-gray-800 text-white h-7 text-[13px]">
                Generate API key
              </Button>
            </div>
          ) : (
            <>
              {/* API Endpoint */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  <span>Endpoint</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 normal-case tracking-normal">POST</span>
                </div>
                <div className="flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:border-gray-700 focus-within:border-indigo-300 transition-colors">
                  <input
                    value={`${window.location.origin}/functions/createTicket`}
                    readOnly
                    className="flex-1 bg-transparent text-[13px] font-mono text-gray-900 dark:text-gray-100 py-1.5 outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/functions/createTicket`, 'url')}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100"
                  >
                    {copySuccess.url ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  <span>API key</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 normal-case tracking-normal">Secret</span>
                </div>
                <div className="flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:border-gray-700 focus-within:border-indigo-300 transition-colors">
                  <input
                    value={project.api_key}
                    readOnly
                    type="password"
                    className="flex-1 bg-transparent text-[13px] font-mono text-gray-900 dark:text-gray-100 py-1.5 outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(project.api_key, 'key')}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100"
                  >
                    {copySuccess.key ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500">Keep secret. Include in the <code className="text-gray-700 dark:text-gray-300">X-API-Key</code> header.</p>
              </div>

              {/* Example Request */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Example request</div>
                <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 p-3 rounded-md overflow-x-auto text-[12px] font-mono leading-relaxed">
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

              {/* Field Documentation */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Request body</div>
                <div className="border-t border-gray-200 dark:border-gray-800">
                  {[
                    { name: 'title', desc: 'Ticket title/summary', required: true },
                    { name: 'description', desc: 'Detailed description' },
                    { name: 'priority', desc: 'low, medium, high, or urgent (default: medium)' },
                    { name: 'status', desc: 'todo, in_progress, review, or completed (default: todo)' },
                    { name: 'requester_name', desc: 'Name of person submitting the ticket' },
                    { name: 'requester_email', desc: 'Email of person submitting the ticket' },
                    { name: 'external_source', desc: 'System name (e.g., "Typeform", "Zapier", "Slack")' },
                    { name: 'external_id', desc: 'ID from external system for reference' },
                    { name: 'due_date', desc: 'Due date in YYYY-MM-DD format' },
                    { name: 'estimated_hours', desc: 'Estimated hours to complete' },
                  ].map(f => (
                    <div key={f.name} className="flex items-start gap-3 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800">
                      <code className="text-[12px] font-mono text-gray-900 dark:text-gray-100 w-36 flex-shrink-0">{f.name}</code>
                      <span className="flex-1 text-[12px] text-gray-600 dark:text-gray-400">{f.desc}</span>
                      {f.required && <span className="text-[10px] font-medium uppercase tracking-wide text-red-600">required</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Integration Tips */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Integration tips</div>
                <ul className="text-[12px] text-gray-600 dark:text-gray-400 space-y-1 leading-relaxed">
                  <li><span className="text-gray-900 dark:text-gray-100 font-medium">Zapier/Make:</span> Use "Webhooks by Zapier" or "HTTP Request" module</li>
                  <li><span className="text-gray-900 dark:text-gray-100 font-medium">Typeform:</span> Set up webhook in Settings → Webhooks</li>
                  <li><span className="text-gray-900 dark:text-gray-100 font-medium">Slack:</span> Create slash command or use incoming webhooks</li>
                  <li><span className="text-gray-900 dark:text-gray-100 font-medium">Email:</span> Use email parser services like Mailgun or SendGrid</li>
                  <li>Tickets appear instantly in the <Link to={createPageUrl("Tasks")} className="text-indigo-600 hover:underline">Tasks page</Link></li>
                  <li>Each ticket gets an auto-incremented number (#1, #2, #3…)</li>
                </ul>
              </div>

              {/* Response Example */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Example response</div>
                <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 p-3 rounded-md overflow-x-auto text-[12px] font-mono leading-relaxed">
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
  "message": "Ticket #42 created successfully"
}`}
                </pre>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Task Drawer */}
      <FormShell
        open={showTaskDrawer}
        onOpenChange={setShowTaskDrawer}
        storageKey="hdo.taskViewMode"
        title={editingTask ? "Edit Task" : "New Task"}
        description={editingTask ? "Update task details" : "Create a new task for this project"}
      >
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
      </FormShell>

      {/* Time Entry Drawer */}
      <FormShell
        open={showTimeDrawer}
        onOpenChange={setShowTimeDrawer}
        storageKey="hdo.timeEntryForm.viewMode"
        title={editingTimeEntry ? "Edit Time Entry" : "New Time Entry"}
        description={editingTimeEntry ? "Update time entry details" : "Log time for this project"}
      >
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
      </FormShell>

      {/* Contact Drawer */}
      <FormShell
        open={showContactDrawer}
        onOpenChange={setShowContactDrawer}
        storageKey="hdo.contactForm.viewMode"
        title={editingContact ? "Edit Contact" : "New Contact"}
        description={editingContact ? "Update contact details" : "Add a new contact for this account"}
      >
        <ContactForm
          contact={editingContact}
          accounts={[account].filter(Boolean)}
          onSubmit={handleContactSubmit}
          onContactUpdated={loadProjectData}
          onCancel={() => {
            setShowContactDrawer(false);
            setEditingContact(null);
          }}
        />
      </FormShell>

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
