import React, { useState, useEffect, useMemo } from "react";
import { Task, Project, Account, TeamMember } from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, X, Trash2, ExternalLink, Kanban, List, Grid3X3 } from "lucide-react";
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
import { api } from "@/api/legacyClient";

export default function Tasks() {
  const { user: authUser, userProfile } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentTeamMember, setCurrentTeamMember] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [viewFilter, setViewFilter] = useState("all");
  const [completedFilter, setCompletedFilter] = useState("active");

  const [viewMode, setViewMode] = useState("list");
  const [groupBy, setGroupBy] = useState("status");

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

  const handleSubmit = async (taskData) => {
    const isNewTask = !editingTask;
    
    if (editingTask) {
      await Task.update(editingTask.id, taskData);
    } else {
      await Task.create(taskData);
    }
    
    if (isNewTask && taskData.assigned_to) {
      try {
        const assignedTeamMember = teamMembersMap[taskData.assigned_to];
        const project = projectsMap[taskData.project_id];

        if (assignedTeamMember?.user_id) {
          await api.functions.invoke('sendNotification', {
            userId: assignedTeamMember.user_id,
            title: 'New Task Assigned',
            message: `You've been assigned to "${taskData.title}"${project ? ` on project "${project.name}"` : ''}.`,
            type: 'info',
            link: '/Tasks',
            sendEmail: true,
            userEmail: assignedUser?.email
          });
        }
      } catch (error) {
        console.error('Error sending task notification:', error);
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
      await Task.update(taskId, { ...task, [field]: value });
      
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
        task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getProjectName(task.project_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.ticket_number?.toString().includes(searchQuery) ||
        task.requester_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      const matchesProject = projectFilter === "all" || task.project_id === projectFilter;
      const matchesAssignee = assigneeFilter === "all" || task.assigned_to === assigneeFilter;
      const matchesView = viewFilter === "all" || task.assigned_to === currentTeamMember?.id;
      
      let matchesDueDate = true;
      if (dueDateFilter !== "all" && task.due_date) {
        const dueDate = new Date(task.due_date);
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
            <Button 
              onClick={() => {
                setEditingTask(null);
                setShowDrawer(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="lg:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {completedFilter === "active" && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>

              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team</SelectItem>
                  {teamMembers.filter(tm => tm.status === 'active').map(tm => (
                    <SelectItem key={tm.id} value={tm.id}>
                      {tm.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Due Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Due Today</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                </SelectContent>
              </Select>
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
                                              {task.description && (
                                                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{task.description}</p>
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
                                                  Due: {new Date(task.due_date).toLocaleDateString()}
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
                            {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
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
          <div className="p-6 lg:p-8 overflow-y-auto h-full">
            <div className="bg-white rounded-lg border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                        onCheckedChange={() => {
                          if (selectedTasks.length === filteredTasks.length) {
                            setSelectedTasks([]);
                          } else {
                            setSelectedTasks(filteredTasks.map(t => t.id));
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Assigned To</TableHead>
                    {completedFilter === "active" && <TableHead>Status</TableHead>}
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        {tasks.length === 0 ? "No tasks yet. Click \"New Task\" to get started." : "No tasks match your filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map((task) => (
                      <TableRow key={task.id} className="hover:bg-gray-50">
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={() => toggleTaskSelection(task.id)}
                          />
                        </TableCell>
                        <TableCell className="cursor-pointer" onClick={() => handleOpenDrawer(task)}>
                          <div>
                            {task.ticket_number && (
                              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                #{task.ticket_number}
                                {task.source && task.source !== 'manual' && (
                                  <span>{sourceIcons[task.source]}</span>
                                )}
                                {task.external_source && (
                                  <span className="text-xs bg-gray-100 px-1 rounded">{task.external_source}</span>
                                )}
                              </div>
                            )}
                            <div className="font-medium">{task.title}</div>
                            {task.requester_name && (
                              <div className="text-xs text-gray-500 mt-1">
                                Requested by: {task.requester_name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{getProjectName(task.project_id)}</TableCell>
                        <TableCell className="text-sm text-gray-600">{getAccountName(task.project_id)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={task.assigned_to || ""}
                            onValueChange={(value) => handleQuickUpdate(task.id, 'assigned_to', value)}
                          >
                            <SelectTrigger className="w-40 border-0 hover:bg-gray-100">
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              {teamMembers.filter(tm => tm.status === 'active').map(tm => (
                                <SelectItem key={tm.id} value={tm.id}>
                                  {tm.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        {completedFilter === "active" && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={task.status}
                              onValueChange={(value) => handleQuickUpdate(task.id, 'status', value)}
                            >
                              <SelectTrigger className="w-32 border-0 hover:bg-gray-100">
                                <SelectValue>
                                  <Badge className={statusColors[task.status]}>
                                    {task.status.replace('_', ' ')}
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="review">Review</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Badge className={`${priorityColors[task.priority]} cursor-pointer transition-colors`}>
                                {task.priority}
                              </Badge>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => handleQuickUpdate(task.id, 'priority', 'low')}>
                                Low
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickUpdate(task.id, 'priority', 'medium')}>
                                Medium
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickUpdate(task.id, 'priority', 'high')}>
                                High
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickUpdate(task.id, 'priority', 'urgent')}>
                                Urgent
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDrawer(task)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmDialog({ open: true, taskIds: [task.id] });
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
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

      <Sheet open={showDrawer} onOpenChange={setShowDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
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
          </div>
        </SheetContent>
      </Sheet>

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