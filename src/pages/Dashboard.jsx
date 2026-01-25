import React, { useState, useEffect } from "react";
import { Task, Project, TimeEntry, Lead, TeamMember, Account } from "@/api/entities";
import { User } from "@/api/entities";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  CheckSquare, 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  FolderKanban,
  Target,
  ArrowRight,
  Plus
} from "lucide-react";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [currentTeamMember, setCurrentTeamMember] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [leads, setLeads] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const [tasksData, projectsData, timeEntriesData, leadsData, teamMembersData] = await Promise.all([
        Task.list("-created_date", 100),
        Project.list("-created_date", 50),
        TimeEntry.list("-date", 100),
        Lead.list("-created_date", 50),
        TeamMember.list()
      ]);

      setTasks(tasksData);
      setProjects(projectsData);
      setTimeEntries(timeEntriesData);
      setLeads(leadsData);

      const myTeamMember = teamMembersData.find(tm => tm.user_id === currentUser.id);
      setCurrentTeamMember(myTeamMember);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  // My Tasks
  const myTasks = currentTeamMember 
    ? tasks.filter(t => t.assigned_to === currentTeamMember.id && t.status !== 'completed')
    : [];
  
  const myOverdueTasks = myTasks.filter(t => {
    if (!t.due_date) return false;
    return new Date(t.due_date) < new Date() && t.status !== 'completed';
  });

  const myTasksDueThisWeek = myTasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    const today = new Date();
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return dueDate >= today && dueDate <= weekFromNow;
  });

  // My Time This Week
  const getWeekStart = () => {
    const today = new Date();
    const first = today.getDate() - today.getDay();
    return new Date(today.setDate(first));
  };

  const weekStart = getWeekStart();
  const myTimeThisWeek = currentTeamMember
    ? timeEntries.filter(te => {
        if (te.team_member_id !== currentTeamMember.id) return false;
        const entryDate = new Date(te.date);
        return entryDate >= weekStart;
      }).reduce((sum, te) => sum + (te.hours || 0), 0)
    : 0;

  // My Projects
  const myProjects = currentTeamMember
    ? projects.filter(p => p.project_manager_id === currentTeamMember.id && p.status === 'active')
    : [];

  // Recent Activity
  const recentTasks = myTasks.slice(0, 5);

  // Team Stats (visible to all)
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const activeLeads = leads.filter(l => l.status !== 'won' && l.status !== 'lost').length;

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || "Unknown";
  };

  const priorityColors = {
    low: "bg-gray-100 text-gray-600",
    medium: "bg-blue-100 text-blue-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700"
  };

  const statusColors = {
    todo: "bg-gray-100 text-gray-800",
    in_progress: "bg-blue-100 text-blue-800",
    review: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-800"
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.full_name?.split(' ')[0] || 'there'}! 👋
        </h1>
        <p className="text-gray-500 mt-1">Here's what's on your plate today</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('Tasks'))}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">My Active Tasks</CardTitle>
            <CheckSquare className="w-5 h-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{myTasks.length}</div>
            {myOverdueTasks.length > 0 && (
              <p className="text-sm text-red-600 mt-1">
                {myOverdueTasks.length} overdue
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('Tasks'))}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Due This Week</CardTitle>
            <Calendar className="w-5 h-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{myTasksDueThisWeek.length}</div>
            <p className="text-sm text-gray-500 mt-1">tasks need attention</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('TimeTracking'))}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Hours This Week</CardTitle>
            <Clock className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{myTimeThisWeek.toFixed(1)}</div>
            <p className="text-sm text-gray-500 mt-1">hours logged</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('Projects'))}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">My Projects</CardTitle>
            <FolderKanban className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{myProjects.length}</div>
            <p className="text-sm text-gray-500 mt-1">active projects</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Tasks */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Tasks</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(createPageUrl('Tasks'))}
            >
              View All <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No active tasks</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => navigate(createPageUrl('Tasks'))}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(createPageUrl('Tasks'))}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{task.title}</h4>
                        <Badge className={priorityColors[task.priority]}>
                          {task.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{getProjectName(task.project_id)}</p>
                      {task.due_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge className={statusColors[task.status]}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Stats */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate(createPageUrl('Tasks'))}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate(createPageUrl('TimeTracking'))}
              >
                <Clock className="w-4 h-4 mr-2" />
                Log Time
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate(createPageUrl('Projects'))}
              >
                <FolderKanban className="w-4 h-4 mr-2" />
                View Projects
              </Button>
            </CardContent>
          </Card>

          {/* Team Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Active Projects</span>
                </div>
                <span className="font-semibold text-gray-900">{activeProjects}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Active Leads</span>
                </div>
                <span className="font-semibold text-gray-900">{activeLeads}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">All Active Tasks</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {tasks.filter(t => t.status !== 'completed').length}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Overdue Alert */}
          {myOverdueTasks.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-base text-red-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Overdue Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-700 mb-3">
                  You have {myOverdueTasks.length} overdue task{myOverdueTasks.length !== 1 ? 's' : ''} that need attention.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-red-300 hover:bg-red-100"
                  onClick={() => navigate(createPageUrl('Tasks'))}
                >
                  View Overdue Tasks
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* My Projects */}
      {myProjects.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Active Projects</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(createPageUrl('Projects'))}
            >
              View All <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myProjects.slice(0, 6).map(project => (
                <div
                  key={project.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(createPageUrl(`ProjectDetail?id=${project.id}`))}
                >
                  <h4 className="font-medium text-gray-900 mb-2">{project.name}</h4>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 capitalize">{project.billing_type}</span>
                    <Badge variant="outline">{project.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}