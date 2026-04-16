import React, { useState, useEffect } from "react";
import { Task, Project, TimeEntry, Lead, TeamMember } from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl, parseLocalDate } from "@/utils";
import { Button } from "@/components/ui/button";
import { Clock, CheckSquare, FolderKanban, Plus, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const { user: authUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentTeamMember, setCurrentTeamMember] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [leads, setLeads] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (authUser) loadDashboardData();
  }, [authUser]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [tasksData, projectsData, timeEntriesData, leadsData, teamMembersData] = await Promise.all([
        Task.list("-created_at", 100),
        Project.list("-created_at", 50),
        TimeEntry.list("-date", 100),
        Lead.list("-created_at", 50),
        TeamMember.list()
      ]);

      setTasks(tasksData);
      setProjects(projectsData);
      setTimeEntries(timeEntriesData);
      setLeads(leadsData);

      const myTeamMember = teamMembersData.find(tm => tm.user_id === authUser?.id);
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parseLocalDate(t.due_date) < today && t.status !== 'completed';
  });

  const myTasksDueThisWeek = myTasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = parseLocalDate(t.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return dueDate >= today && dueDate <= weekFromNow;
  });

  // My Time This Week
  const getWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.getFullYear(), now.getMonth(), diff);
  };

  const weekStart = getWeekStart();
  const myTimeThisWeek = currentTeamMember
    ? timeEntries.filter(te => {
        if (te.team_member_id !== currentTeamMember.id) return false;
        const entryDate = parseLocalDate(te.date);
        return entryDate >= weekStart;
      }).reduce((sum, te) => sum + (te.hours || 0), 0)
    : 0;

  // My Projects
  const myProjects = currentTeamMember
    ? projects.filter(p => p.project_manager_id === currentTeamMember.id && p.status === 'active')
    : [];

  // Recent Activity
  const recentTasks = myTasks.slice(0, 8);

  // Team Stats
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const activeLeads = leads.filter(l => l.status !== 'won' && l.status !== 'lost').length;
  const allActiveTasks = tasks.filter(t => t.status !== 'completed').length;

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || "Unknown";
  };

  const priorityDot = {
    low: "bg-gray-400",
    medium: "bg-blue-500",
    high: "bg-orange-500",
    urgent: "bg-red-500"
  };

  const statusDot = {
    todo: "bg-gray-400",
    in_progress: "bg-blue-500",
    blocked: "bg-red-500",
    review: "bg-yellow-500",
    completed: "bg-green-500"
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-64"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const firstName = userProfile?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Welcome back, {firstName}</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">Here's what's on your plate today</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => navigate(createPageUrl('TimeTracking'))}
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Log time
          </Button>
          <Button
            size="sm"
            className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
            onClick={() => navigate(createPageUrl('Tasks'))}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New task
          </Button>
        </div>
      </div>

      {/* Metric pill strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-b border-gray-200 dark:border-gray-800 py-2.5">
        <button
          onClick={() => navigate(createPageUrl('Tasks'))}
          className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span>My tasks</span>
          <span className="text-gray-900 dark:text-gray-100 font-medium">{myTasks.length}</span>
        </button>
        <button
          onClick={() => navigate(createPageUrl('Tasks'))}
          className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span>Overdue</span>
          <span className={`font-medium ${myOverdueTasks.length > 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
            {myOverdueTasks.length}
          </span>
        </button>
        <button
          onClick={() => navigate(createPageUrl('Tasks'))}
          className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          <span>Due this week</span>
          <span className="text-gray-900 dark:text-gray-100 font-medium">{myTasksDueThisWeek.length}</span>
        </button>
        <button
          onClick={() => navigate(createPageUrl('TimeTracking'))}
          className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span>Hours this week</span>
          <span className="text-gray-900 dark:text-gray-100 font-medium">{myTimeThisWeek.toFixed(1)}</span>
        </button>
        <button
          onClick={() => navigate(createPageUrl('Projects'))}
          className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span>My projects</span>
          <span className="text-gray-900 dark:text-gray-100 font-medium">{myProjects.length}</span>
        </button>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* My Tasks list */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between h-7 mb-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">My Tasks</div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[12px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => navigate(createPageUrl('Tasks'))}
            >
              View all
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          {recentTasks.length === 0 ? (
            <div className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-8 text-center">
              <div className="text-[13px] text-gray-600 dark:text-gray-400 mb-2">No active tasks</div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => navigate(createPageUrl('Tasks'))}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Create task
              </Button>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-800 rounded-md">
              {recentTasks.map((task, idx) => (
                <div
                  key={task.id}
                  onClick={() => navigate(createPageUrl('Tasks'))}
                  className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer ${
                    idx !== recentTasks.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot[task.priority] || 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-gray-900 dark:text-gray-100 truncate">{task.title}</div>
                    <div className="text-[12px] text-gray-500 truncate">{getProjectName(task.project_id)}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {task.due_date && (
                      <span className="text-[12px] text-gray-500">
                        {parseLocalDate(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 min-w-[80px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot[task.status] || 'bg-gray-400'}`} />
                      <span className="text-[12px] text-gray-600 dark:text-gray-400 capitalize">{task.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick actions */}
          <div>
            <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">
              Quick actions
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-md">
              <button
                onClick={() => navigate(createPageUrl('Tasks'))}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800"
              >
                <Plus className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                <span>Create task</span>
              </button>
              <button
                onClick={() => navigate(createPageUrl('TimeTracking'))}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800"
              >
                <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                <span>Log time</span>
              </button>
              <button
                onClick={() => navigate(createPageUrl('Projects'))}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <FolderKanban className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                <span>View projects</span>
              </button>
            </div>
          </div>

          {/* Team overview */}
          <div>
            <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">
              Team overview
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-md">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-[13px] text-gray-600 dark:text-gray-400">Active projects</span>
                <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium">{activeProjects}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-[13px] text-gray-600 dark:text-gray-400">Active leads</span>
                <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium">{activeLeads}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[13px] text-gray-600 dark:text-gray-400">All active tasks</span>
                <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium">{allActiveTasks}</span>
              </div>
            </div>
          </div>

          {/* Overdue alert */}
          {myOverdueTasks.length > 0 && (
            <div>
              <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">
                Attention
              </div>
              <div className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium">
                    {myOverdueTasks.length} overdue task{myOverdueTasks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-[12px] text-gray-500 mb-2">
                  Tasks past their due date that need attention.
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[12px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => navigate(createPageUrl('Tasks'))}
                >
                  View overdue
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* My active projects */}
      {myProjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between h-7 mb-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">My Active Projects</div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[12px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => navigate(createPageUrl('Projects'))}
            >
              View all
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-md">
            {myProjects.slice(0, 8).map((project, idx) => (
              <div
                key={project.id}
                onClick={() => navigate(createPageUrl(`ProjectDetail?id=${project.id}`))}
                className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer ${
                  idx !== Math.min(myProjects.length, 8) - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-[13px] text-gray-900 dark:text-gray-100 truncate">{project.name}</div>
                <span className="text-[12px] text-gray-500 capitalize flex-shrink-0">{project.billing_type}</span>
                <div className="flex items-center gap-1.5 min-w-[70px] flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[12px] text-gray-600 dark:text-gray-400 capitalize">{project.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
