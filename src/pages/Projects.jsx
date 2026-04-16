import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Project, Account } from "@/api/entities";
import { sendNotification } from "@/api/functions";
import InlineEdit from "@/components/ui/InlineEdit";
import { supabase } from "@/api/supabaseClient";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Building2, ExternalLink, Search, Trash2, Filter, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ProjectStatusIcon,
  ProjectStatusPicker,
  PROJECT_STATUS_LIST,
  RiskDot,
} from "../components/projects/ProjectIcons";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import ProjectForm from "../components/projects/ProjectForm";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  
  // Filter states
  const [activeTab, setActiveTab] = useState("client");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [billingFilter, setBillingFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");

  const [deleteDialog, setDeleteDialog] = useState({ open: false, projectId: null });
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    loadData();
  }, []);

  // Handle ?new=1 from command palette
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditingProject(null);
      setShowDrawer(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsData, accountsData] = await Promise.all([
        Project.list("-created_at"),
        Account.list()
      ]);
      setProjects(projectsData);
      setAccounts(accountsData);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const notifyAdmins = async ({ title, message, link = "/Projects", priority = "normal", source = "projects.update" }) => {
    const { data: admins } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("role", "admin");

    if (!admins?.length) return;

    await Promise.all(
      admins
        .filter(a => a.id !== user?.id)
        .map((admin) => sendNotification({
          userId: admin.id,
          type: "info",
          category: "projects",
          priority,
          source,
          title,
          message,
          link,
        }))
    );
  };

  const handleSubmit = async (projectData) => {
    try {
      const wasRiskRaised = editingProject && (editingProject.risk_level !== "high" && projectData.risk_level === "high");

      if (editingProject) {
        await Project.update(editingProject.id, projectData);
      } else {
        await Project.create(projectData);
        await notifyAdmins({
          title: "New project created",
          message: `Project created: ${projectData.name || "Untitled Project"}`,
          source: "projects.created",
        });
      }

      if (wasRiskRaised) {
        await notifyAdmins({
          title: "Project risk escalated",
          message: `${projectData.name || editingProject.name} is now marked high risk`,
          priority: "high",
          source: "projects.risk_high",
        });
      }

      if (editingProject && editingProject.status !== "completed" && projectData.status === "completed") {
        await notifyAdmins({
          title: "Project completed",
          message: `${projectData.name || editingProject.name} was marked completed`,
          source: "projects.completed",
        });
      }

      setShowDrawer(false);
      setEditingProject(null);
      loadData();
    } catch (error) {
      console.error("Error saving project:", error);
    }
  };

  const handleDelete = async () => {
    if (deleteDialog.projectId) {
      try {
        await Project.delete(deleteDialog.projectId);
        setDeleteDialog({ open: false, projectId: null });
        loadData();
      } catch (error) {
        console.error("Error deleting project:", error);
      }
    }
  };

  // Inline status change from the list row
  const handleQuickStatusChange = async (projectId, newStatus) => {
    try {
      const saved = await Project.update(projectId, { status: newStatus });
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...saved } : p)));
    } catch (err) {
      console.error("status change failed:", err);
    }
  };

  const handleInlineRename = async (projectId, name) => {
    try {
      const saved = await Project.update(projectId, { name });
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...saved } : p)));
    } catch (err) {
      console.error("rename failed:", err);
    }
  };

  // Auto-save from the edit drawer
  const handleAutoSave = async (projectData) => {
    if (!editingProject?.id) return;
    try {
      const saved = await Project.update(editingProject.id, projectData);
      setEditingProject((prev) => (prev ? { ...prev, ...saved } : prev));
      setProjects((prev) => prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)));
    } catch (err) {
      console.error("Auto-save failed:", err);
      throw err;
    }
  };

  const handleRowClick = (projectId) => {
    navigate(createPageUrl(`ProjectDetail?id=${projectId}`));
  };

  const getAccount = (accountId) => {
    return accounts.find(a => a.id === accountId);
  };

  const getAccountName = (accountId) => {
    return getAccount(accountId)?.company_name || "Unknown";
  };

  // Filter projects by tab first, then by other filters
  const projectsByTab = projects.filter(project => {
    const isInternal = project.is_internal || project.billing_type === 'internal';
    return activeTab === "internal" ? isInternal : !isInternal;
  });

  const filteredProjects = projectsByTab.filter(project => {
    const account = getAccount(project.account_id);
    
    // Search filter
    const matchesSearch = searchQuery === "" || 
      project.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account?.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    
    // Billing filter
    const matchesBilling = billingFilter === "all" || project.billing_type === billingFilter;
    
    // Risk filter
    const matchesRisk = riskFilter === "all" || (project.risk_level || "low") === riskFilter;
    
    // Account filter (only for client projects)
    const matchesAccount = activeTab === "internal" || accountFilter === "all" || project.account_id === accountFilter;
    
    return matchesSearch && matchesStatus && matchesBilling && matchesRisk && matchesAccount;
  });

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

  const clientProjectsCount = projects.filter(p => !p.is_internal && p.billing_type !== 'internal').length;
  const internalProjectsCount = projects.filter(p => p.is_internal || p.billing_type === 'internal').length;

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (activeTab === "client" && billingFilter !== "all" ? 1 : 0) +
    (activeTab === "client" && riskFilter !== "all" ? 1 : 0) +
    (activeTab === "client" && accountFilter !== "all" ? 1 : 0);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Consolidated toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 px-4 h-12">
          <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5 text-[12px]">
            <button
              type="button"
              onClick={() => setActiveTab("client")}
              className={`px-2.5 py-1 rounded ${
                activeTab === "client"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Client <span className="opacity-60">({clientProjectsCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("internal")}
              className={`px-2.5 py-1 rounded ${
                activeTab === "internal"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Internal <span className="opacity-60">({internalProjectsCount})</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-md min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5" />
            <Input
              placeholder="Search projects"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-[13px] border-gray-200 dark:border-gray-800 focus-visible:ring-1"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5 h-8 text-[13px]">
                <Filter className="w-3.5 h-3.5" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Filters</span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                    onClick={() => {
                      setStatusFilter("all");
                      setBillingFilter("all");
                      setRiskFilter("all");
                      setAccountFilter("all");
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {activeTab === "client" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Billing</label>
                    <Select value={billingFilter} onValueChange={setBillingFilter}>
                      <SelectTrigger><SelectValue placeholder="Billing" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Billing</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="retainer">Retainer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Risk</label>
                    <Select value={riskFilter} onValueChange={setRiskFilter}>
                      <SelectTrigger><SelectValue placeholder="Risk" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Risk</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Account</label>
                    <Select value={accountFilter} onValueChange={setAccountFilter}>
                      <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Accounts</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>

          <div className="ml-auto">
            <Button
              onClick={() => {
                setEditingProject(null);
                setShowDrawer(true);
              }}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 h-8 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Project
            </Button>
          </div>
        </div>
      </div>

      <LinearProjectList
        projects={filteredProjects}
        loading={loading}
        allCount={projectsByTab.length}
        activeTab={activeTab}
        getAccount={getAccount}
        isAdmin={isAdmin}
        onRowClick={handleRowClick}
        onEdit={(p) => {
          setEditingProject(p);
          setShowDrawer(true);
        }}
        onDelete={(id) => setDeleteDialog({ open: true, projectId: id })}
        onQuickStatusChange={handleQuickStatusChange}
        onInlineRename={handleInlineRename}
      />

      <Sheet open={showDrawer} onOpenChange={setShowDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingProject ? "Edit Project" : "New Project"}</SheetTitle>
            <SheetDescription>
              {editingProject ? "Update project details" : "Create a new project"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ProjectForm
              project={editingProject}
              accounts={accounts}
              onSubmit={handleSubmit}
              onAutoSave={handleAutoSave}
              onCancel={() => {
                setShowDrawer(false);
                setEditingProject(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone and will affect all related tasks and time entries.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, projectId: null })}
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

/* ---------- Linear-style project list ---------- */

function ProjectRow({
  project,
  activeTab,
  account,
  isAdmin,
  onRowClick,
  onEdit,
  onDelete,
  onQuickStatusChange,
  onInlineRename,
}) {
  return (
    <div
      className="group flex items-center gap-2 pl-3 pr-2 h-10 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
      onClick={() => onRowClick(project.id)}
    >
      <ProjectStatusPicker
        value={project.status}
        onChange={(v) => onQuickStatusChange(project.id, v)}
      >
        <ProjectStatusIcon status={project.status} size={14} />
      </ProjectStatusPicker>

      <div className="shrink-0 w-5 flex justify-center">
        <RiskDot risk={project.risk_level} />
      </div>

      <span className="flex-1 min-w-0 text-[13px] text-gray-900 dark:text-gray-100 font-medium">
        <InlineEdit
          value={project.name}
          onSave={(next) => onInlineRename(project.id, next)}
          placeholder="Untitled project"
        />
      </span>

      {activeTab === "client" && account && (
        <span
          className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-gray-500 shrink-0 max-w-[200px] truncate"
          onClick={(e) => e.stopPropagation()}
        >
          {account.logo_url ? (
            <img
              src={account.logo_url}
              alt=""
              className="w-4 h-4 rounded object-contain bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            <Building2 className="w-3 h-3 text-gray-400 dark:text-gray-500" />
          )}
          <span className="truncate">{account.company_name}</span>
        </span>
      )}

      {activeTab === "client" && project.project_type && (
        <span className="hidden lg:inline capitalize text-[11px] text-gray-500 shrink-0">
          {project.project_type.replace(/_/g, " ")}
        </span>
      )}

      {activeTab === "client" && project.billing_type && (
        <span className="hidden lg:inline capitalize text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
          {project.billing_type}
        </span>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(project);
        }}
        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        title="Edit"
      >
        <Edit className="w-3.5 h-3.5" />
      </button>
      {isAdmin && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(project.id);
          }}
          className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function LinearProjectList({
  projects,
  loading,
  allCount,
  activeTab,
  getAccount,
  isAdmin,
  onRowClick,
  onEdit,
  onDelete,
  onQuickStatusChange,
  onInlineRename,
}) {
  const [collapsed, setCollapsed] = React.useState(() => new Set());
  const toggleGroup = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const grouped = React.useMemo(() => {
    const m = new Map();
    for (const s of PROJECT_STATUS_LIST) m.set(s.id, []);
    for (const p of projects) {
      if (m.has(p.status)) m.get(p.status).push(p);
    }
    return m;
  }, [projects]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">Loading…</div>;
  }
  if (projects.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
        {allCount === 0
          ? `No ${activeTab} projects yet. Click "New Project" to get started.`
          : "No projects match your filters."}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1 min-h-0 bg-white dark:bg-gray-950">
      {PROJECT_STATUS_LIST.map((s) => {
        const groupProjects = grouped.get(s.id) || [];
        const isCollapsed = collapsed.has(s.id);
        if (groupProjects.length === 0) return null;
        return (
          <div key={s.id}>
            <button
              type="button"
              onClick={() => toggleGroup(s.id)}
              className="w-full flex items-center gap-2 px-3 h-8 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronRight
                className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
              />
              <ProjectStatusIcon status={s.id} size={12} />
              <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300">{s.label}</span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{groupProjects.length}</span>
            </button>
            {!isCollapsed &&
              groupProjects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  activeTab={activeTab}
                  account={getAccount(project.account_id)}
                  isAdmin={isAdmin}
                  onRowClick={onRowClick}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onQuickStatusChange={onQuickStatusChange}
                  onInlineRename={onInlineRename}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}