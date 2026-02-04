import React, { useState, useEffect } from "react";
import { TimeEntry, Project, Task, TeamMember } from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Calendar as CalendarIcon,
  Edit,
  Trash2,
  Search,
  Clock,
  TrendingUp,
  DollarSign,
  FileText,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TimeEntryForm from "../components/time/TimeEntryForm";
import WeeklyCalendarView from "../components/time/WeeklyCalendarView";

export default function TimeTracking() {
  const { user: authUser, userProfile } = useAuth();
  const [timeEntries, setTimeEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTeamMember, setCurrentTeamMember] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [deleteDialog, setDeleteDialog] = useState({ open: false, entryId: null });

  // Filters
  const [dateRange, setDateRange] = useState("week");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [teamMemberFilter, setTeamMemberFilter] = useState("me");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (authUser) {
      loadData();
    }
  }, [authUser]);

  useEffect(() => {
    setDateRangePreset("week");
  }, []);

  const setDateRangePreset = (preset) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start, end;

    switch (preset) {
      case "today":
        start = today;
        end = today;
        break;
      case "week":
        start = new Date(today);
        start.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        break;
      case "month":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case "last-month":
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      default:
        return;
    }

    setDateRange(preset);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const navigateWeek = (direction) => {
    const current = new Date(startDate);
    current.setDate(current.getDate() + (direction * 7));
    const end = new Date(current);
    end.setDate(current.getDate() + 6);

    setDateRange("custom");
    setStartDate(current.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [entriesData, projectsData, tasksData, teamMembersData] = await Promise.all([
        TimeEntry.list("-date"),
        Project.list(),
        Task.list(),
        TeamMember.list()
      ]);

      setTimeEntries(entriesData);
      setProjects(projectsData);
      setTasks(tasksData);
      setTeamMembers(teamMembersData);

      const myTeamMember = teamMembersData.find(tm => tm.user_id === authUser?.id);
      setCurrentTeamMember(myTeamMember);
    } catch (error) {
      console.error("Error loading time tracking:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (entryData) => {
    if (editingEntry) {
      await TimeEntry.update(editingEntry.id, entryData);
    } else {
      await TimeEntry.create(entryData);
    }
    setShowDrawer(false);
    setEditingEntry(null);
    loadData();
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setShowDrawer(true);
  };

  const handleDelete = async () => {
    if (deleteDialog.entryId) {
      await TimeEntry.delete(deleteDialog.entryId);
      setDeleteDialog({ open: false, entryId: null });
      loadData();
    }
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || "Unknown";
  };

  const getTaskTitle = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    return task?.title || "";
  };

  const getTeamMemberName = (teamMemberId) => {
    const member = teamMembers.find(tm => tm.id === teamMemberId);
    return member?.full_name || "Unknown";
  };

  const getProject = (projectId) => {
    return projects.find(p => p.id === projectId);
  };

  const getBillingDisplay = (entry) => {
    const project = getProject(entry.project_id);
    if (!project) return { label: "Unknown", color: "bg-gray-100 text-gray-700" };

    if (project.billing_type === 'retainer' || project.billing_type === 'exit') {
      return { label: "Retainer", color: "bg-purple-100 text-purple-700" };
    }

    if (entry.billable) {
      return { label: "Billable", color: "bg-emerald-100 text-emerald-700" };
    }
    return { label: "Internal", color: "bg-gray-100 text-gray-600" };
  };

  const getStatusDisplay = (entry) => {
    const project = getProject(entry.project_id);
    if (!project) return { label: "Unknown", color: "bg-gray-100 text-gray-700" };

    if (project.billing_type === 'retainer' || project.billing_type === 'exit') {
      return { label: "Tracked", color: "bg-blue-100 text-blue-700" };
    }

    if (entry.client_billed) {
      return { label: "Billed", color: "bg-blue-100 text-blue-700" };
    }
    if (entry.billable) {
      return { label: "Unbilled", color: "bg-amber-100 text-amber-700" };
    }
    return { label: "N/A", color: "bg-gray-100 text-gray-600" };
  };

  const isAdmin = userProfile?.role === "admin";

  // Filter entries
  const filteredEntries = timeEntries.filter(entry => {
    if (startDate || endDate) {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (entryDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (entryDate > end) return false;
      }
    }

    if (teamMemberFilter === "me" && currentTeamMember) {
      if (entry.team_member_id !== currentTeamMember.id) return false;
    } else if (teamMemberFilter !== "all" && teamMemberFilter !== "me") {
      if (entry.team_member_id !== teamMemberFilter) return false;
    }

    if (projectFilter !== "all" && entry.project_id !== projectFilter) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const projectName = getProjectName(entry.project_id).toLowerCase();
      const taskTitle = getTaskTitle(entry.task_id).toLowerCase();
      const description = (entry.description || "").toLowerCase();

      if (!projectName.includes(query) && !taskTitle.includes(query) && !description.includes(query)) {
        return false;
      }
    }

    return true;
  });

  const totalHours = filteredEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const hourlyBillableHours = filteredEntries.filter(e => {
    const project = getProject(e.project_id);
    return project?.billing_type === 'hourly' && e.billable;
  }).reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const retainerHours = filteredEntries.filter(e => {
    const project = getProject(e.project_id);
    return project?.billing_type === 'retainer' || project?.billing_type === 'exit';
  }).reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const unbilledHours = filteredEntries.filter(e => {
    const project = getProject(e.project_id);
    return project?.billing_type === 'hourly' && e.billable && !e.client_billed;
  }).reduce((sum, entry) => sum + (entry.hours || 0), 0);

  const formatDateRange = () => {
    if (!startDate || !endDate) return "";
    const start = new Date(startDate);
    const end = new Date(endDate);
    const opts = { month: 'short', day: 'numeric' };

    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-US', opts)} - ${end.getDate()}`;
    }
    return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track and manage your work hours</p>
        </div>
        <Button
          onClick={() => {
            setEditingEntry(null);
            setShowDrawer(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Log Time
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Retainer</p>
              <p className="text-2xl font-bold text-purple-600">{retainerHours.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Billable</p>
              <p className="text-2xl font-bold text-emerald-600">{hourlyBillableHours.toFixed(1)}</p>
              {unbilledHours > 0 && (
                <p className="text-xs text-amber-600">{unbilledHours.toFixed(1)}h unbilled</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Entries</p>
              <p className="text-2xl font-bold text-gray-900">{filteredEntries.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Date Range Presets */}
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {[
                { key: "today", label: "Today" },
                { key: "week", label: "Week" },
                { key: "month", label: "Month" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDateRangePreset(key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    dateRange === key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Week Navigation */}
            <div className="flex items-center gap-1 border-l pl-2 ml-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => navigateWeek(-1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
                {formatDateRange()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => navigateWeek(1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px h-8 bg-gray-200" />

          {/* Other Filters */}
          <div className="flex flex-1 flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.filter(p => p.status === 'active').map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isAdmin && (
              <Select value={teamMemberFilter} onValueChange={setTeamMemberFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">My Time</SelectItem>
                  <SelectItem value="all">All Team</SelectItem>
                  {teamMembers.filter(tm => tm.status === 'active').map(tm => (
                    <SelectItem key={tm.id} value={tm.id}>
                      {tm.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* View Toggle + Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/50">
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList className="h-8">
              <TabsTrigger value="list" className="text-xs px-3">List</TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs px-3">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="text-sm text-gray-500">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {viewMode === "list" ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Project</TableHead>
                <TableHead className="font-semibold">Task</TableHead>
                {isAdmin && <TableHead className="font-semibold">Team Member</TableHead>}
                <TableHead className="font-semibold">Hours</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-12 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-12">
                    <div className="text-gray-500">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p>No time entries found</p>
                      <p className="text-sm">Click "Log Time" to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-gray-50/50">
                    <TableCell className="font-medium">
                      {new Date(entry.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-gray-900">{getProjectName(entry.project_id)}</span>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {entry.task_id ? getTaskTitle(entry.task_id) : "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-gray-600">{getTeamMemberName(entry.team_member_id)}</TableCell>
                    )}
                    <TableCell>
                      <span className="font-semibold text-indigo-600">{entry.hours}h</span>
                    </TableCell>
                    <TableCell className="text-gray-600 max-w-[200px] truncate">
                      {entry.description || "—"}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const billing = getBillingDisplay(entry);
                        return <Badge className={`${billing.color} font-medium`}>{billing.label}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const status = getStatusDisplay(entry);
                        return <Badge className={`${status.color} font-medium`}>{status.label}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(entry)}
                        >
                          <Edit className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteDialog({ open: true, entryId: entry.id })}
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
        ) : (
          <div className="p-4">
            <WeeklyCalendarView
              timeEntries={filteredEntries}
              projects={projects}
              tasks={tasks}
              teamMembers={teamMembers}
              onEditEntry={handleEdit}
              onAddEntry={() => {
                setEditingEntry(null);
                setShowDrawer(true);
              }}
            />
          </div>
        )}
      </div>

      <Sheet open={showDrawer} onOpenChange={setShowDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingEntry ? "Edit Time Entry" : "Log Time"}</SheetTitle>
            <SheetDescription>
              {editingEntry ? "Update time entry details" : "Record hours worked on a project"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <TimeEntryForm
              timeEntry={editingEntry}
              projects={projects}
              tasks={tasks}
              teamMembers={teamMembers}
              currentTeamMember={currentTeamMember}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowDrawer(false);
                setEditingEntry(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Time Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this time entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, entryId: null })}
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
