import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Project, Account } from "@/api/entities";
import { sendNotification } from "@/api/functions";
import { supabase } from "@/api/supabaseClient";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Building2, ExternalLink, Search, Trash2 } from "lucide-react";
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

  useEffect(() => {
    loadData();
  }, []);

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

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-1">Track all your ongoing work</p>
        </div>
        <Button 
          onClick={() => {
            setEditingProject(null);
            setShowDrawer(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="client">
            Client Projects ({clientProjectsCount})
          </TabsTrigger>
          <TabsTrigger value="internal">
            Internal Projects ({internalProjectsCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg border shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {activeTab === "client" && (
                <>
                  <Select value={billingFilter} onValueChange={setBillingFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Billing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Billing</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="retainer">Retainer</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Risk" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risk</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {activeTab === "client" && (
              <div className="grid grid-cols-1 mt-4">
                <Select value={accountFilter} onValueChange={setAccountFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {(searchQuery || statusFilter !== "all" || (activeTab === "client" && (billingFilter !== "all" || riskFilter !== "all" || accountFilter !== "all"))) && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-gray-600">Active filters:</span>
                <div className="flex gap-2 flex-wrap">
                  {searchQuery && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchQuery("")}>
                      Search: {searchQuery} ×
                    </Badge>
                  )}
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setStatusFilter("all")}>
                      Status: {statusFilter} ×
                    </Badge>
                  )}
                  {activeTab === "client" && billingFilter !== "all" && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setBillingFilter("all")}>
                      Billing: {billingFilter} ×
                    </Badge>
                  )}
                  {activeTab === "client" && riskFilter !== "all" && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setRiskFilter("all")}>
                      Risk: {riskFilter} ×
                    </Badge>
                  )}
                  {activeTab === "client" && accountFilter !== "all" && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setAccountFilter("all")}>
                      Account: {getAccountName(accountFilter)} ×
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  {activeTab === "client" && <TableHead>Account</TableHead>}
                  {activeTab === "client" && <TableHead>Type</TableHead>}
                  {activeTab === "client" && <TableHead>Billing</TableHead>}
                  <TableHead>Status</TableHead>
                  {activeTab === "client" && <TableHead>Risk</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {projectsByTab.length === 0 
                        ? `No ${activeTab} projects yet. Click "New Project" to get started.` 
                        : "No projects match your filters."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProjects.map((project) => {
                    const account = getAccount(project.account_id);
                    const isInternal = project.is_internal || project.billing_type === 'internal';
                    
                    return (
                      <TableRow 
                        key={project.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleRowClick(project.id)}
                      >
                        <TableCell>
                          <span className="font-medium">{project.name}</span>
                        </TableCell>
                        {activeTab === "client" && (
                          <>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {account?.logo_url ? (
                                  <img 
                                    src={account.logo_url} 
                                    alt={account.company_name} 
                                    className="w-8 h-8 rounded object-contain bg-gray-50 p-1 border"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      if (e.target.nextElementSibling) {
                                        e.target.nextElementSibling.style.display = 'flex';
                                      }
                                    }}
                                  />
                                ) : null}
                                <div className={`w-8 h-8 bg-indigo-100 rounded flex items-center justify-center ${account?.logo_url ? 'hidden' : ''}`}>
                                  <Building2 className="w-4 h-4 text-indigo-600" />
                                </div>
                                <span>{account?.company_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="capitalize">
                              {project.project_type?.replace('_', ' ') || '—'}
                            </TableCell>
                            <TableCell className="capitalize">
                              {project.billing_type}
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <Badge className={statusColors[project.status]}>
                            {project.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        {activeTab === "client" && (
                          <TableCell>
                            <Badge className={riskColors[project.risk_level || 'low']}>
                              {(project.risk_level || 'low').toUpperCase()}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProject(project);
                                setShowDrawer(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteDialog({ open: true, projectId: project.id });
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

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