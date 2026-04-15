import React, { useState, useEffect, useMemo } from "react";
import { Task, Project, Account, TeamMember, TaskAttachment } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { parseLocalDate } from "@/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, X, Trash2, ExternalLink, Kanban, List, Grid3X3, PanelRight, Maximize2, Filter, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { stripHtml } from "@/components/ui/RichTextEditor";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TaskForm from "../components/tasks/TaskForm";
import TaskComments from "../components/tasks/TaskComments";
import {
  StatusIcon,
  StatusPicker,
  PriorityIcon,
  PriorityPicker,
  STATUS_LIST,
} from "../components/tasks/TaskIcons";
import { api } from "@/api/legacyClient";
import { sendNotification } from "@/api/functions";

export default function Tasks() {
  const { user: authUser, userProfile } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentTeamMember, setCurrentTeamMember] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskViewMode, setTaskViewMode] = useState(() => {
    if (typeof window === "undefined") return "sidebar";
    return window.localStorage.getItem("hdo.taskViewMode") || "sidebar";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hdo.taskViewMode", taskViewMode);
    }
  }, [taskViewMode]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [viewFilter, setViewFilter] = useState("all");
  const [completedFilter, setCompletedFilter] = useState("active");

  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState("list");
  const [groupBy, setGroupBy] = useState("status");

  // Default to board view on mobile
  useEffect(() => {
    if (isMobile) setViewMode("board");
  }, [isMobile]);

  const [selectedTasks, setSelectedTasks] = useState([]);

  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ open: false, taskIds: [] });

  const projectsMap = useMemo(() => {
    return projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {});
  }, [projects]);

  const accountsMap = useMemo(() => {
    return accounts.reduce((acc, account) => {
      acc[account.id] = account;
      return acc;
    }, {});
  }, [accounts]);

  const teamMembersMap = useMemo(() => {
    return teamMembers.reduce((acc, tm) => {
      acc[tm.id] = tm;
      return acc;
    }, {});
  }, [teamMembers]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksData, projectsData, accountsData, teamMembersData] = await Promise.all([
        Task.list("-created_at", 500),
        Project.list("-created_at", 200),
        Account.list("-created_at", 100),
        TeamMember.list()
      ]);

      setTasks(tasksData);
      setProjects(projectsData);
      setAccounts(accountsData);
      setTeamMembers(teamMembersData);

      const myTeamMember = teamMembersData.find(tm => tm.user_id === authUser?.id);
      setCurrentTeamMember(myTeamMember);
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (taskData, pendingFiles = []) => {
    const isNewTask = !editingTask;
    let savedTask;

    if (editingTask) {
      savedTask = await Task.update(editingTask.id, taskData);
    } else {
      savedTask = await Task.create(taskData);
    }

    // Upload any files queued during new-task creation
    if (isNewTask && savedTask?.id && pendingFiles.length > 0) {
      try {
        for (const file of pendingFiles) {
          const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
          const safeBase = file.name
            .replace(/\.[^/.]+$/, "")
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .slice(0, 80);
          const path = `tasks/${savedTask.id}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}-${safeBase}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("uploads")
            .upload(path, file, { cacheControl: "3600", upsert: false });
          if (uploadError) throw uploadError;

          await TaskAttachment.create({
            task_id: savedTask.id,
            file_path: path,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type || null,
            uploaded_by: authUser?.id || null,
          });
        }
      } catch (err) {
        console.error("Error uploading task attachments:", err);
      }
    }
    
    // Send notification on new task assignment or reassignment
    if (taskData.assigned_to) {
      const assignedTM = teamMembersMap[taskData.assigned_to];
      const wasReassigned = editingTask && editingTask.assigned_to !== taskData.assigned_to;
      
      if ((isNewTask || wasReassigned) && assignedTM?.user_id) {
        try {
          const project = projectsMap[taskData.project_id];
          await sendNotification({
            userId: assignedTM.user_id,
            type: 'info',
            category: 'tasks',
            priority: 'high',
            source: 'tasks.assignment',
            title: isNewTask ? 'New Task Assigned' : 'Task Reassigned to You',
            message: `"${taskData.title}"${project ? ` on ${project.name}` : ''}`,
            link: '/Tasks'
          });
        } catch (error) {
          console.error('Error sending task notification:', error);
        }
      }
    }
    
    setShowDrawer(false);
    setEditingTask(null);
    loadData();
  };

  const handleOpenDrawer = (task) => {
    setEditingTask(task);
    setShowDrawer(true);
  };

  const handleQuickUpdate = async (taskId, field, value) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      await Task.update(taskId, { ...task, [field]: value });

      // Send notification on reassignment
      if (field === 'assigned_to' && value && value !== task.assigned_to) {
        const assignedTM = teamMembersMap[value];
        if (assignedTM?.user_id) {
          const project = projectsMap[task.project_id];
          await sendNotification({
            userId: assignedTM.user_id,
            type: 'info',
            category: 'tasks',
            priority: 'high',
            source: 'tasks.reassignment',
            title: 'Task Assigned to You',
            message: `"${task.title}"${project ? ` on ${project.name}` : ''}`,
            link: '/Tasks'
          });
        }
      }

      setTasks(prevTasks => 
        prevTasks.map(t => t.id === taskId ? { ...t, [field]: value } : t)
      );
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const task = tasks.find(t => t.id === draggableId);
    if (task && source.droppableId !== destination.droppableId) {
      await Task.update(task.id, { ...task, status: destination.droppableId });
      
      setTasks(prevTasks => 
        prevTasks.map(t => t.id === draggableId ? { ...t, status: destination.droppableId } : t)
      );
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(deleteConfirmDialog.taskIds.map(id => Task.delete(id)));
      setSelectedTasks([]);
      setDeleteConfirmDialog({ open: false, taskIds: [] });
      
      setTasks(prevTasks => prevTasks.filter(t => !deleteConfirmDialog.taskIds.includes(t.id)));
    } catch (error) {
      console.error("Error deleting tasks:", error);
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    try {
      await Promise.all(
        selectedTasks.map(taskId => {
          const task = tasks.find(t => t.id === taskId);
          return Task.update(taskId, { ...task, status: newStatus });
        })
      );
      setSelectedTasks([]);
      
      setTasks(prevTasks => 
        prevTasks.map(t => selectedTasks.includes(t.id) ? { ...t, status: newStatus } : t)
      );
    } catch (error) {
      console.error("Error updating tasks:", error);
    }
  };

  const toggleTaskSelection = (taskId) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const getProjectName = (projectId) => {
    if (!projectId) return "No Project";
    return projectsMap[projectId]?.name || "Unknown";
  };

  const getAccountName = (projectId) => {
    const project = projectsMap[projectId];
    return accountsMap[project?.account_id]?.company_name || "";
  };

  const getTeamMemberName = (teamMemberId) => {
    return teamMembersMap[teamMemberId]?.full_name || "Unassigned";
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesCompleted = completedFilter === "completed" 
        ? task.status === "completed"
        : task.status !== "completed";
      
      if (!matchesCompleted) return false;
      
      const matchesSearch = !searchQuery || 
        task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stripHtml(task.description)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getProjectName(task.project_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.ticket_number?.toString().includes(searchQuery) ||
        task.requester_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      const matchesProject = projectFilter === "all" || task.project_id === projectFilter;
      const matchesAssignee = assigneeFilter === "all" || task.assigned_to === assigneeFilter;
      const matchesView = viewFilter === "all" || task.assigned_to === currentTeamMember?.id;
      
      let matchesDueDate = true;
      if (dueDateFilter !== "all") {
        if (!task.due_date) {
          matchesDueDate = false;
        } else {
          const dueDate = parseLocalDate(task.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (dueDateFilter === "overdue") {
            matchesDueDate = dueDate < today && task.status !== "completed";
          } else if (dueDateFilter === "today") {
            matchesDueDate = dueDate.toDateString() === today.toDateString();
          } else if (dueDateFilter === "this_week") {
            const weekFromNow = new Date(today);
            weekFromNow.setDate(weekFromNow.getDate() + 7);
            matchesDueDate = dueDate >= today && dueDate <= weekFromNow;
          } else if (dueDateFilter === "this_month") {
            matchesDueDate = dueDate.getMonth() === today.getMonth() && dueDate.getFullYear() === today.getFullYear();
          }
        }
      }
      
      return matchesSearch && matchesStatus && matchesPriority && matchesProject && matchesAssignee && matchesView && matchesDueDate;
    });
  }, [tasks, completedFilter, searchQuery, statusFilter, priorityFilter, projectFilter, assigneeFilter, viewFilter, dueDateFilter, currentTeamMember, projectsMap]);

  const groupedTasks = useMemo(() => {
    const groups = {};
    
    filteredTasks.forEach(task => {
      let key;
      if (groupBy === "status") {
        key = task.status;
      } else if (groupBy === "project") {
        key = getProjectName(task.project_id);
      } else if (groupBy === "priority") {
        key = task.priority;
      } else if (groupBy === "assignee") {
        key = getTeamMemberName(task.assigned_to);
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(task);
    });
    
    return groups;
  }, [filteredTasks, groupBy, projectsMap, teamMembersMap]);

  const statusColors = {
    todo: "bg-gray-100 text-gray-800 border-gray-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    review: "bg-yellow-100 text-yellow-800 border-yellow-200",
    completed: "bg-green-100 text-green-800 border-green-200"
  };

  const priorityColors = {
    low: "bg-gray-100 text-gray-600",
    medium: "bg-blue-100 text-blue-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700"
  };

  const sourceIcons = {
    manual: null,
    api: "🔌",
    webhook: "⚡",
    email: "📧",
    form: "📝"
  };

  const kanbanColumns = [
    { id: "todo", label: "To Do", color: "bg-gray-500", textColor: "text-gray-500", bgLight: "bg-gray-50" },
    { id: "in_progress", label: "In Progress", color: "bg-blue-500", textColor: "text-blue-500", bgLight: "bg-blue-50" },
    { id: "review", label: "Review", color: "bg-yellow-500", textColor: "text-yellow-500", bgLight: "bg-yellow-50" },
    { id: "completed", label: "Completed", color: "bg-green-500", textColor: "text-green-500", bgLight: "bg-green-50" }
  ];

  const getTasksByStatus = (status) => {
    return filteredTasks.filter(task => task.status === status);
  };

  const boardStatuses = completedFilter === "active" 
    ? ["todo", "in_progress", "review"]
    : ["completed"];

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="border-b bg-white shadow-sm">
        <div className="p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
              <p className="text-gray-500 mt-1">Manage all project tasks</p>
            </div>
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <QuickAddTask
                authUser={authUser}
                currentTeamMember={currentTeamMember}
                onCreated={(task) => {
                  setTasks((prev) => [task, ...prev]);
                }}
              />
              <Button
                onClick={() => {
                  setEditingTask(null);
                  setShowDrawer(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={completedFilter} onValueChange={setCompletedFilter}>
                <TabsList>
                  <TabsTrigger value="active">Active Tasks</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>
              </Tabs>

              <Tabs value={viewFilter} onValueChange={setViewFilter}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="my">My Tasks</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex items-center gap-2">
              {viewMode === "grouped" && (
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Group by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="assignee">Assignee</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              <Tabs value={viewMode} onValueChange={setViewMode}>
                <TabsList>
                  <TabsTrigger value="list">
                    <List className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="board">
                    <Kanban className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="grouped">
                    <Grid3X3 className="w-4 h-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="bg-white rounded-lg border shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {(() => {
                const activeCount =
                  (completedFilter === "active" && statusFilter !== "all" ? 1 : 0) +
                  (priorityFilter !== "all" ? 1 : 0) +
                  (projectFilter !== "all" ? 1 : 0) +
                  (assigneeFilter !== "all" ? 1 : 0) +
                  (dueDateFilter !== "all" ? 1 : 0);
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="shrink-0 gap-2">
                        <Filter className="w-4 h-4" />
                        Filters
                        {activeCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold">
                            {activeCount}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Filters</span>
                        {activeCount > 0 && (
                          <button
                            type="button"
                            className="text-xs text-indigo-600 hover:text-indigo-700"
                            onClick={() => {
                              setStatusFilter("all");
                              setPriorityFilter("all");
                              setProjectFilter("all");
                              setAssigneeFilter("all");
                              setDueDateFilter("all");
                            }}
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      {completedFilter === "active" && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-600">Status</label>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="todo">To Do</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="review">Review</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600">Priority</label>
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                          <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Priority</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600">Project</label>
                        <Select value={projectFilter} onValueChange={setProjectFilter}>
                          <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Projects</SelectItem>
                            {projects.map(project => (
                              <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600">Assignee</label>
                        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                          <SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Team</SelectItem>
                            {teamMembers.filter(tm => tm.status === 'active').map(tm => (
                              <SelectItem key={tm.id} value={tm.id}>{tm.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600">Due Date</label>
                        <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
                          <SelectTrigger><SelectValue placeholder="Due Date" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Dates</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="today">Due Today</SelectItem>
                            <SelectItem value="this_week">This Week</SelectItem>
                            <SelectItem value="this_month">This Month</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })()}
            </div>

            {(searchQuery || statusFilter !== "all" || priorityFilter !== "all" || projectFilter !== "all" || assigneeFilter !== "all" || dueDateFilter !== "all") && (
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
                      Status: {statusFilter.replace('_', ' ')} ×
                    </Badge>
                  )}
                  {priorityFilter !== "all" && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setPriorityFilter("all")}>
                      Priority: {priorityFilter} ×
                    </Badge>
                  )}
                  {projectFilter !== "all" && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setProjectFilter("all")}>
                      Project: {getProjectName(projectFilter)} ×
                    </Badge>
                  )}
                  {assigneeFilter !== "all" && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setAssigneeFilter("all")}>
                      Assignee: {getTeamMemberName(assigneeFilter)} ×
                    </Badge>
                  )}
                  {dueDateFilter !== "all" && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setDueDateFilter("all")}>
                      Due: {dueDateFilter.replace('_', ' ')} ×
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        {viewMode === "board" && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="h-full overflow-x-auto">
              <div className="inline-flex h-full gap-4 p-6 lg:p-8 min-w-full">
                {(completedFilter === "active" ? kanbanColumns.filter(c => c.id !== "completed") : kanbanColumns.filter(c => c.id === "completed")).map((column) => {
                  const columnTasks = getTasksByStatus(column.id);
                  return (
                    <div key={column.id} className="flex-shrink-0 w-80 flex flex-col">
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                            <h3 className="font-semibold text-gray-900">{column.label}</h3>
                            <Badge variant="secondary" className="bg-gray-100">
                              {columnTasks.length}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <Droppable droppableId={column.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 rounded-xl transition-colors ${
                              snapshot.isDraggingOver 
                                ? `${column.bgLight} ring-2 ring-${column.color}` 
                                : 'bg-gray-50'
                            } p-3 overflow-y-auto`}
                          >
                            <div className="space-y-3">
                              {columnTasks.map((task, index) => (
                                <Draggable key={task.id} draggableId={task.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                    >
                                      <Card 
                                        className={`cursor-pointer hover:shadow-lg transition-all ${
                                          snapshot.isDragging 
                                            ? 'shadow-2xl ring-2 ring-indigo-400 rotate-2' 
                                            : ''
                                        }`}
                                        onClick={() => handleOpenDrawer(task)}
                                      >
                                        <CardContent className="p-4">
                                          <div className="space-y-3">
                                            <div>
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                  {task.ticket_number && (
                                                    <div className="text-xs text-gray-500 mb-1">
                                                      #{task.ticket_number}
                                                      {task.source && task.source !== 'manual' && (
                                                        <span className="ml-2">{sourceIcons[task.source]}</span>
                                                      )}
                                                    </div>
                                                  )}
                                                  <h4 className="font-semibold text-gray-900 line-clamp-2">
                                                    {task.title}
                                                  </h4>
                                                </div>
                                                <Badge className={priorityColors[task.priority]}>
                                                  {task.priority}
                                                </Badge>
                                              </div>
                                              {task.description && stripHtml(task.description) && (
                                                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{stripHtml(task.description)}</p>
                                              )}
                                              {task.requester_name && (
                                                <p className="text-xs text-gray-500 mt-2">
                                                  Requested by: {task.requester_name}
                                                </p>
                                              )}
                                            </div>

                                            <div className="space-y-1">
                                              <Badge variant="outline" className="text-xs">
                                                {getProjectName(task.project_id)}
                                              </Badge>
                                              {task.assigned_to && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                  {getTeamMemberName(task.assigned_to)}
                                                </p>
                                              )}
                                            </div>

                                            {task.due_date && (
                                              <div className="pt-2 border-t border-gray-100">
                                                <p className="text-xs text-gray-500">
                                                  Due: {parseLocalDate(task.due_date).toLocaleDateString()}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                              
                              {columnTasks.length === 0 && (
                                <div className="text-center py-8 text-gray-400">
                                  <p className="text-sm">No tasks</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </div>
          </DragDropContext>
        )}

        {viewMode === "grouped" && (
          <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
            {Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
              <Card key={groupName}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="capitalize">{groupName}</span>
                    <Badge variant="secondary">{groupTasks.length} tasks</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupTasks.map(task => (
                        <TableRow key={task.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleOpenDrawer(task)}>
                          <TableCell>
                            <div>
                              {task.ticket_number && (
                                <div className="text-xs text-gray-500 mb-1">
                                  #{task.ticket_number}
                                  {task.source && task.source !== 'manual' && (
                                    <span className="ml-2">{sourceIcons[task.source]}</span>
                                  )}
                                </div>
                              )}
                              <div className="font-medium">{task.title}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{getProjectName(task.project_id)}</TableCell>
                          <TableCell className="text-sm">{getTeamMemberName(task.assigned_to)}</TableCell>
                          <TableCell>
                            <Badge className={priorityColors[task.priority]}>
                              {task.priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {task.due_date ? parseLocalDate(task.due_date).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDrawer(task);
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {viewMode === "list" && (
          <LinearTaskList
            tasks={filteredTasks}
            loading={loading}
            allTaskCount={tasks.length}
            completedFilter={completedFilter}
            teamMembers={teamMembers}
            projectsMap={projectsMap}
            accountsMap={accountsMap}
            teamMembersMap={teamMembersMap}
            selectedTasks={selectedTasks}
            onToggleSelect={toggleTaskSelection}
            onToggleSelectAll={() => {
              if (selectedTasks.length === filteredTasks.length) setSelectedTasks([]);
              else setSelectedTasks(filteredTasks.map((t) => t.id));
            }}
            onOpenTask={handleOpenDrawer}
            onQuickUpdate={handleQuickUpdate}
            onDelete={(taskId) => setDeleteConfirmDialog({ open: true, taskIds: [taskId] })}
          />
        )}
      </div>

      {selectedTasks.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white rounded-lg shadow-2xl p-4 z-50">
          <div className="flex items-center gap-4">
            <span className="font-medium">
              {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm">
                    Change Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange('todo')}>
                    To Do
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange('in_progress')}>
                    In Progress
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange('review')}>
                    Review
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange('completed')}>
                    Completed
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setDeleteConfirmDialog({ open: true, taskIds: selectedTasks })}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSelectedTasks([])}
              className="text-white hover:text-white hover:bg-indigo-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {taskViewMode === "sidebar" ? (
        <Sheet open={showDrawer} onOpenChange={setShowDrawer}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <button
              type="button"
              onClick={() => setTaskViewMode("center")}
              className="absolute right-12 top-4 p-1 rounded-sm opacity-70 hover:opacity-100 text-gray-500 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              title="Switch to center view"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <SheetHeader>
              <SheetTitle>{editingTask ? "Edit Task" : "New Task"}</SheetTitle>
              <SheetDescription>
                {editingTask ? "Update task details" : "Create a new task"}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <TaskForm
                task={editingTask}
                projects={projects}
                teamMembers={teamMembers}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowDrawer(false);
                  setEditingTask(null);
                }}
              />
              {editingTask && (
                <div className="mt-8 pt-6 border-t">
                  <TaskComments
                    taskId={editingTask.id}
                    task={editingTask}
                    teamMembers={teamMembers}
                    projectsMap={projectsMap}
                  />
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={showDrawer} onOpenChange={setShowDrawer}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setTaskViewMode("sidebar")}
              className="absolute right-12 top-4 p-1 rounded-sm opacity-70 hover:opacity-100 text-gray-500 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              title="Switch to sidebar view"
            >
              <PanelRight className="w-4 h-4" />
            </button>
            <DialogHeader>
              <DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
              <DialogDescription>
                {editingTask ? "Update task details" : "Create a new task"}
              </DialogDescription>
            </DialogHeader>
            <div className={`mt-4 grid gap-8 ${editingTask ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
              <div className="min-w-0">
                <TaskForm
                  task={editingTask}
                  projects={projects}
                  teamMembers={teamMembers}
                  onSubmit={handleSubmit}
                  onCancel={() => {
                    setShowDrawer(false);
                    setEditingTask(null);
                  }}
                />
              </div>
              {editingTask && (
                <div className="min-w-0 lg:border-l lg:pl-8">
                  <TaskComments
                    taskId={editingTask.id}
                    task={editingTask}
                    teamMembers={teamMembers}
                    projectsMap={projectsMap}
                  />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={deleteConfirmDialog.open} onOpenChange={(open) => setDeleteConfirmDialog({ ...deleteConfirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteConfirmDialog.taskIds.length} task{deleteConfirmDialog.taskIds.length !== 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmDialog({ open: false, taskIds: [] })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDueDate(iso) {
  if (!iso) return null;
  const d = parseLocalDate(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((dueStart - startOfToday) / (1000 * 60 * 60 * 24));
  let label;
  if (days === 0) label = "Today";
  else if (days === 1) label = "Tomorrow";
  else if (days === -1) label = "Yesterday";
  else if (days > 1 && days <= 6) label = d.toLocaleDateString(undefined, { weekday: "short" });
  else label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const overdue = days < 0;
  return { label, overdue };
}

function initialsOf(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function AssigneePicker({ value, teamMembers, onChange, children }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 max-h-64 overflow-y-auto">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
          }}
          className={value === "" || !value ? "bg-gray-100 font-medium" : ""}
        >
          Unassigned
        </DropdownMenuItem>
        {teamMembers
          .filter((tm) => tm.status === "active")
          .map((tm) => (
            <DropdownMenuItem
              key={tm.id}
              onClick={(e) => {
                e.stopPropagation();
                onChange(tm.id);
              }}
              className={`flex items-center gap-2 ${value === tm.id ? "bg-gray-100 font-medium" : ""}`}
            >
              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold flex items-center justify-center">
                {initialsOf(tm.full_name)}
              </div>
              <span className="truncate">{tm.full_name}</span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaskRow({
  task,
  teamMembers,
  teamMembersMap,
  projectsMap,
  selected,
  onToggleSelect,
  onOpenTask,
  onQuickUpdate,
  onDelete,
}) {
  const assignee = task.assigned_to ? teamMembersMap[task.assigned_to] : null;
  const project = task.project_id ? projectsMap[task.project_id] : null;
  const due = formatDueDate(task.due_date);
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  const doneCount = checklist.filter((i) => i.done).length;

  return (
    <div
      className={`group flex items-center gap-2 pl-3 pr-2 h-9 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
        selected ? "bg-indigo-50/40" : ""
      }`}
      onClick={() => onOpenTask(task)}
    >
      <div
        className="flex items-center justify-center w-5 shrink-0 opacity-0 group-hover:opacity-100 data-[checked=true]:opacity-100"
        data-checked={selected}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(task.id)} />
      </div>

      {task.ticket_number && (
        <span className="hidden sm:inline text-[11px] text-gray-400 tabular-nums w-12 shrink-0 truncate">
          #{task.ticket_number}
        </span>
      )}

      <StatusPicker
        value={task.status}
        onChange={(v) => onQuickUpdate(task.id, "status", v)}
      >
        <StatusIcon status={task.status} size={14} />
      </StatusPicker>

      <PriorityPicker
        value={task.priority}
        onChange={(v) => onQuickUpdate(task.id, "priority", v)}
      >
        <PriorityIcon priority={task.priority} size={14} />
      </PriorityPicker>

      <span
        className={`flex-1 min-w-0 truncate text-[13px] ${
          task.status === "completed" ? "text-gray-400 line-through" : "text-gray-900"
        }`}
      >
        {task.title}
      </span>

      {checklist.length > 0 && (
        <span className="hidden md:inline text-[11px] text-gray-400 tabular-nums shrink-0">
          {doneCount}/{checklist.length}
        </span>
      )}

      {project && (
        <span className="hidden lg:inline-flex items-center max-w-[140px] text-[11px] text-gray-500 truncate shrink-0">
          {project.name}
        </span>
      )}

      {due && (
        <span
          className={`hidden md:inline-flex items-center gap-1 text-[11px] shrink-0 tabular-nums ${
            due.overdue ? "text-red-600" : "text-gray-500"
          }`}
        >
          <CalendarIcon className="w-3 h-3" />
          {due.label}
        </span>
      )}

      <AssigneePicker
        value={task.assigned_to || ""}
        teamMembers={teamMembers}
        onChange={(v) => onQuickUpdate(task.id, "assigned_to", v)}
      >
        <button
          type="button"
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:ring-2 hover:ring-indigo-200"
          title={assignee?.full_name || "Unassigned"}
        >
          {assignee ? (
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold flex items-center justify-center">
              {initialsOf(assignee.full_name)}
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-[10px]">
              ?
            </div>
          )}
        </button>
      </AssigneePicker>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(task.id);
        }}
        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function LinearTaskList({
  tasks,
  loading,
  allTaskCount,
  completedFilter,
  teamMembers,
  projectsMap,
  accountsMap,
  teamMembersMap,
  selectedTasks,
  onToggleSelect,
  onToggleSelectAll,
  onOpenTask,
  onQuickUpdate,
  onDelete,
}) {
  const [collapsed, setCollapsed] = React.useState(() => new Set());
  const toggleGroup = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const visibleStatuses = React.useMemo(
    () =>
      completedFilter === "completed"
        ? STATUS_LIST.filter((s) => s.id === "completed")
        : STATUS_LIST.filter((s) => s.id !== "completed"),
    [completedFilter],
  );

  const grouped = React.useMemo(() => {
    const m = new Map();
    for (const s of visibleStatuses) m.set(s.id, []);
    for (const t of tasks) {
      if (m.has(t.status)) m.get(t.status).push(t);
    }
    return m;
  }, [tasks, visibleStatuses]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>;
  }
  if (tasks.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-400">
        {allTaskCount === 0
          ? "No tasks yet. Click \"New Task\" to get started."
          : "No tasks match your filters."}
      </div>
    );
  }

  const allSelected = selectedTasks.length === tasks.length && tasks.length > 0;

  return (
    <div className="overflow-y-auto h-full bg-white">
      <div className="flex items-center gap-2 px-3 h-8 border-b border-gray-200 bg-gray-50/60 text-[11px] text-gray-500 sticky top-0 z-10">
        <div className="flex items-center justify-center w-5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} />
        </div>
        <span>{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
      </div>

      {visibleStatuses.map((s) => {
        const groupTasks = grouped.get(s.id) || [];
        const isCollapsed = collapsed.has(s.id);
        return (
          <div key={s.id}>
            <button
              type="button"
              onClick={() => toggleGroup(s.id)}
              className="w-full flex items-center gap-2 px-3 h-8 bg-gray-50 border-b border-gray-200 hover:bg-gray-100"
            >
              <ChevronRight
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
              />
              <StatusIcon status={s.id} size={12} />
              <span className="text-[12px] font-medium text-gray-700">{s.label}</span>
              <span className="text-[11px] text-gray-400 tabular-nums">{groupTasks.length}</span>
            </button>
            {!isCollapsed &&
              (groupTasks.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-gray-400 italic border-b border-gray-100">
                  No tasks
                </div>
              ) : (
                groupTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    teamMembers={teamMembers}
                    teamMembersMap={teamMembersMap}
                    projectsMap={projectsMap}
                    selected={selectedTasks.includes(task.id)}
                    onToggleSelect={onToggleSelect}
                    onOpenTask={onOpenTask}
                    onQuickUpdate={onQuickUpdate}
                    onDelete={onDelete}
                  />
                ))
              ))}
          </div>
        );
      })}
    </div>
  );
}

function QuickAddTask({ authUser, currentTeamMember, onCreated }) {
  const [title, setTitle] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || submitting) return;
    setSubmitting(true);
    try {
      const created = await Task.create({
        title: t,
        status: "todo",
        priority: "medium",
        assigned_to: currentTeamMember?.id || null,
      });
      onCreated?.(created);
      setTitle("");
    } catch (err) {
      console.error("quick add failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 lg:w-80">
      <div className="relative">
        <Plus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quick add task and press Enter"
          className="pl-8"
          disabled={submitting}
        />
      </div>
    </form>
  );
}