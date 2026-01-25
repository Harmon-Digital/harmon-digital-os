
import React, { useState, useEffect } from "react";
import { TimeEntry, Project, Task, TeamMember } from "@/api/entities";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Calendar as CalendarIcon, Edit, Trash2, Search } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TimeEntryForm from "../components/time/TimeEntryForm";
import WeeklyCalendarView from "../components/time/WeeklyCalendarView";

export default function TimeTracking() {
  const [timeEntries, setTimeEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTeamMember, setCurrentTeamMember] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [deleteDialog, setDeleteDialog] = useState({ open: false, entryId: null });

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [teamMemberFilter, setTeamMemberFilter] = useState("me");
  const [billableFilter, setBillableFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Set default to this week
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Adjust for Sunday (0) being the first day
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    setStartDate(monday.toISOString().split('T')[0]);
    setEndDate(sunday.toISOString().split('T')[0]);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

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

      const myTeamMember = teamMembersData.find(tm => tm.user_id === user.id);
      setCurrentTeamMember(myTeamMember);

      // Initialize team member filter if not already set or if user is not admin
      if (!isAdmin && teamMemberFilter === "all" && myTeamMember) {
        setTeamMemberFilter("me");
      } else if (isAdmin && teamMemberFilter === "me" && !myTeamMember) {
        // Fallback for admin user without own team member entry
        setTeamMemberFilter("all");
      }


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

  const isAdmin = currentUser?.role === "admin";

  // Filter entries
  const filteredEntries = timeEntries.filter(entry => {
    // Date filter
    if (startDate || endDate) {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0); // Normalize to start of day for comparison
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (entryDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        // Set end date to end of day for inclusive range
        end.setHours(23, 59, 59, 999); 
        if (entryDate > end) return false;
      }
    }

    // Team member filter
    if (teamMemberFilter === "me" && currentTeamMember) {
      if (entry.team_member_id !== currentTeamMember.id) return false;
    } else if (teamMemberFilter !== "all" && teamMemberFilter !== "me") {
      if (entry.team_member_id !== teamMemberFilter) return false;
    }

    // Project filter
    if (projectFilter !== "all" && entry.project_id !== projectFilter) return false;

    // Billable filter
    if (billableFilter === "billable" && !entry.billable) return false;
    if (billableFilter === "non-billable" && entry.billable) return false;

    // Search filter
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
  const billableHours = filteredEntries.filter(e => e.billable).reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const unbilledHours = filteredEntries.filter(e => e.billable && !e.client_billed).reduce((sum, entry) => sum + (entry.hours || 0), 0);

  const resetFilters = () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    setStartDate(monday.toISOString().split('T')[0]);
    setEndDate(sunday.toISOString().split('T')[0]);
    setProjectFilter("all");
    setTeamMemberFilter("me");
    setBillableFilter("all");
    setSearchQuery("");
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Time Tracking</h1>
          <p className="text-gray-500 mt-1">Track hours worked on projects</p>
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

      {/* Filters */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset to This Week
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Date Range */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Date Range</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Other Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search entries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Project"/>
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
              </div>

              {isAdmin && (
                <div className="space-y-2">
                  <Label>Team Member</Label>
                  <Select value={teamMemberFilter} onValueChange={setTeamMemberFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Team Member"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Team</SelectItem>
                      <SelectItem value="me">My Time</SelectItem>
                      {teamMembers.filter(tm => tm.status === 'active').map(tm => (
                        <SelectItem key={tm.id} value={tm.id}>
                          {tm.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Billable</Label>
                <Select value={billableFilter} onValueChange={setBillableFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Billable Status"/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="billable">Billable</SelectItem>
                    <SelectItem value="non-billable">Non-billable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t text-sm text-gray-600">
            Showing {filteredEntries.length} of {timeEntries.length} time entries
            {(startDate || endDate) && (
              <span className="ml-2 text-indigo-600 font-medium">
                {startDate && `from ${new Date(startDate).toLocaleDateString()}`}
                {startDate && endDate && ' '}
                {endDate && `to ${new Date(endDate).toLocaleDateString()}`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{totalHours.toFixed(1)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Billable Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{billableHours.toFixed(1)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Unbilled Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{unbilledHours.toFixed(1)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-600">{filteredEntries.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={viewMode} onValueChange={setViewMode} className="mb-6">
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>
      </Tabs>

      {viewMode === "list" ? (
        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Task</TableHead>
                {isAdmin && <TableHead>Team Member</TableHead>}
                <TableHead>Hours</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Billable</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-gray-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-gray-500">
                    No time entries found. Click "Log Time" to get started or adjust filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        {new Date(entry.date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{getProjectName(entry.project_id)}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {entry.task_id ? getTaskTitle(entry.task_id) : "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-sm">{getTeamMemberName(entry.team_member_id)}</TableCell>
                    )}
                    <TableCell className="font-semibold text-indigo-600">{entry.hours}h</TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                      {entry.description || "—"}
                    </TableCell>
                    <TableCell>
                      {entry.billable ? (
                        <Badge className="bg-green-100 text-green-800">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.client_billed ? (
                        <Badge className="bg-blue-100 text-blue-800">Billed</Badge>
                      ) : entry.billable ? (
                        <Badge className="bg-orange-100 text-orange-800">Unbilled</Badge>
                      ) : (
                        <Badge variant="secondary">Non-billable</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, entryId: entry.id })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
      ) : (
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
      )}

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
