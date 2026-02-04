import React, { useState, useEffect } from "react";
import { Project, Task, Account, TimeEntry, TeamMember } from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Clock, Play, Pause, Square, CheckCircle, Briefcase, Building2, X, Timer } from "lucide-react";

export default function QuickActions() {
  const { user: authUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [actualStartTime, setActualStartTime] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [pausedDuration, setPausedDuration] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerProject, setTimerProject] = useState("");
  const [timerTask, setTimerTask] = useState("");
  const [timerDescription, setTimerDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [currentTeamMember, setCurrentTeamMember] = useState(null);

  const [activeDialog, setActiveDialog] = useState(null);
  const [quickTaskData, setQuickTaskData] = useState({ title: "", project_id: "" });
  const [quickProjectData, setQuickProjectData] = useState({ name: "", account_id: "" });
  const [quickAccountData, setQuickAccountData] = useState({ company_name: "" });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadData();
    loadTimerState();
  }, []);

  useEffect(() => {
    let interval;
    if (timerRunning && !timerPaused && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime - pausedDuration) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerPaused, startTime, pausedDuration]);

  useEffect(() => {
    if (timerRunning) {
      saveTimerState();
    }
  }, [timerRunning, timerPaused, startTime, actualStartTime, pausedDuration, timerProject, timerTask, timerDescription]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const loadData = async () => {
    try {
      const [projectsData, tasksData, accountsData, teamMembersData] = await Promise.all([
        Project.list(),
        Task.list(),
        Account.list(),
        TeamMember.list(),
      ]);

      // Only show active projects
      setProjects(projectsData.filter(p => p.status === 'active'));
      setTasks(tasksData.filter(t => t.status !== 'completed'));
      setAccounts(accountsData.filter(a => a.status === 'active'));

      const myTeamMember = teamMembersData.find(tm => tm.user_id === authUser?.id);
      setCurrentTeamMember(myTeamMember);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const loadTimerState = () => {
    const saved = localStorage.getItem('quickActionsTimer');
    if (saved) {
      const state = JSON.parse(saved);
      setTimerRunning(state.running || false);
      setTimerPaused(state.paused || false);
      setStartTime(state.startTime || null);
      setActualStartTime(state.actualStartTime || null);
      setPausedDuration(state.pausedDuration || 0);
      setTimerProject(state.project || "");
      setTimerTask(state.task || "");
      setTimerDescription(state.description || "");
    }
  };

  const saveTimerState = () => {
    localStorage.setItem('quickActionsTimer', JSON.stringify({
      running: timerRunning,
      paused: timerPaused,
      startTime,
      actualStartTime,
      pausedDuration,
      project: timerProject,
      task: timerTask,
      description: timerDescription,
    }));
  };

  const clearTimerState = () => {
    localStorage.removeItem('quickActionsTimer');
  };

  const handleStartTimer = () => {
    if (!timerProject) {
      showToast("Please select a project first", "error");
      return;
    }

    const now = Date.now();
    const actualStart = new Date(now);

    setStartTime(now);
    setActualStartTime(actualStart.toISOString());
    setPausedDuration(0);
    setElapsedTime(0);
    setTimerRunning(true);
    setTimerPaused(false);
    setIsOpen(false);

    const projectName = projects.find(p => p.id === timerProject)?.name;
    showToast(`Timer started for ${projectName}`);
  };

  const handlePauseTimer = () => {
    if (!timerPaused) {
      setPausedDuration(prev => prev + (Date.now() - startTime));
      setTimerPaused(true);
      showToast("Timer paused");
    } else {
      setStartTime(Date.now());
      setTimerPaused(false);
      showToast("Timer resumed");
    }
  };

  const handleStopTimer = async () => {
    if (!timerProject || !currentTeamMember || !actualStartTime) {
      showToast("Cannot save: missing project or team member", "error");
      return;
    }

    const now = Date.now();
    const totalMs = timerPaused
      ? pausedDuration
      : (now - startTime + pausedDuration);
    const hours = Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;

    if (hours < 0.01) {
      showToast("Timer must run for at least 1 minute", "error");
      return;
    }

    setSaving(true);
    try {
      const startDate = new Date(actualStartTime);
      const endDate = new Date(now);

      // Format as HH:MM:SS for time columns
      const formatTime = (date) => {
        return date.toTimeString().split(' ')[0]; // Gets "HH:MM:SS"
      };

      await TimeEntry.create({
        project_id: timerProject,
        task_id: timerTask || null,
        team_member_id: currentTeamMember.id,
        date: startDate.toISOString().split('T')[0],
        start_time: formatTime(startDate),
        end_time: formatTime(endDate),
        hours: hours,
        description: timerDescription,
        billable: true,
      });

      // Reset timer
      setTimerRunning(false);
      setTimerPaused(false);
      setStartTime(null);
      setActualStartTime(null);
      setPausedDuration(0);
      setElapsedTime(0);
      setTimerProject("");
      setTimerTask("");
      setTimerDescription("");
      clearTimerState();
      setIsOpen(false);

      showToast(`Saved ${hours.toFixed(2)} hours`);
    } catch (error) {
      console.error("Error saving time entry:", error);
      showToast("Failed to save time entry", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardTimer = () => {
    if (confirm("Discard this timer without saving?")) {
      setTimerRunning(false);
      setTimerPaused(false);
      setStartTime(null);
      setActualStartTime(null);
      setPausedDuration(0);
      setElapsedTime(0);
      setTimerProject("");
      setTimerTask("");
      setTimerDescription("");
      clearTimerState();
      setIsOpen(false);
      showToast("Timer discarded");
    }
  };

  const handleQuickTask = async () => {
    if (!quickTaskData.title || !quickTaskData.project_id) return;

    try {
      await Task.create({
        title: quickTaskData.title,
        project_id: quickTaskData.project_id,
        status: "todo",
        priority: "medium",
      });

      setQuickTaskData({ title: "", project_id: "" });
      setActiveDialog(null);
      loadData();
      showToast("Task created");
    } catch (error) {
      console.error("Error creating task:", error);
      showToast("Failed to create task", "error");
    }
  };

  const handleQuickProject = async () => {
    if (!quickProjectData.name) return;

    try {
      await Project.create({
        name: quickProjectData.name,
        account_id: quickProjectData.account_id || null,
        status: "active",
        billing_type: "hourly",
      });

      setQuickProjectData({ name: "", account_id: "" });
      setActiveDialog(null);
      loadData();
      showToast("Project created");
    } catch (error) {
      console.error("Error creating project:", error);
      showToast("Failed to create project", "error");
    }
  };

  const handleQuickAccount = async () => {
    if (!quickAccountData.company_name) return;

    try {
      await Account.create({
        company_name: quickAccountData.company_name,
        status: "active",
      });

      setQuickAccountData({ company_name: "" });
      setActiveDialog(null);
      loadData();
      showToast("Account created");
    } catch (error) {
      console.error("Error creating account:", error);
      showToast("Failed to create account", "error");
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredTasks = timerProject
    ? tasks.filter(t => t.project_id === timerProject)
    : [];

  const currentProjectName = projects.find(p => p.id === timerProject)?.name;

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-24 right-6 z-[60] px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right-5 ${
          toast.type === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-gray-900 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Running Timer Indicator (shown outside popover) */}
      {timerRunning && !isOpen && (
        <div
          className="fixed bottom-6 right-24 z-50 cursor-pointer"
          onClick={() => setIsOpen(true)}
        >
          <div className={`flex items-center gap-3 px-4 py-2 rounded-full shadow-lg ${
            timerPaused ? 'bg-yellow-500' : 'bg-green-500'
          } text-white`}>
            <Timer className={`w-4 h-4 ${!timerPaused && 'animate-pulse'}`} />
            <span className="font-mono font-semibold">{formatTime(elapsedTime)}</span>
            <span className="text-sm opacity-90 max-w-[120px] truncate">{currentProjectName}</span>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-50">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              className={`rounded-full w-14 h-14 shadow-lg transition-all ${
                timerRunning
                  ? timerPaused
                    ? 'bg-yellow-500 hover:bg-yellow-600'
                    : 'bg-green-500 hover:bg-green-600'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {timerRunning ? (
                <Clock className="w-6 h-6 text-white" />
              ) : (
                <Plus className="w-6 h-6 text-white" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            {timerRunning ? (
              <div className="p-4 space-y-4">
                {/* Timer Header */}
                <div className={`-m-4 mb-4 p-4 rounded-t-lg ${timerPaused ? 'bg-yellow-50' : 'bg-green-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium uppercase tracking-wide ${timerPaused ? 'text-yellow-600' : 'text-green-600'}`}>
                      {timerPaused ? 'Paused' : 'Recording'}
                    </span>
                    <button
                      onClick={handleDiscardTimer}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className={`text-4xl font-mono font-bold ${timerPaused ? 'text-yellow-700' : 'text-green-700'}`}>
                    {formatTime(elapsedTime)}
                  </div>
                </div>

                {/* Project Info */}
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">{currentProjectName}</p>
                  {timerTask && (
                    <p className="text-sm text-gray-500">
                      {tasks.find(t => t.id === timerTask)?.title}
                    </p>
                  )}
                  {actualStartTime && (
                    <p className="text-xs text-gray-400">
                      Started at {formatDateTime(actualStartTime)}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">What are you working on?</Label>
                  <Textarea
                    value={timerDescription}
                    onChange={(e) => setTimerDescription(e.target.value)}
                    placeholder="Add a description..."
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handlePauseTimer}
                    variant="outline"
                    className="flex-1"
                  >
                    {timerPaused ? (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleStopTimer}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    disabled={saving}
                  >
                    <Square className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Start Timer Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Timer className="w-4 h-4" />
                    Start Timer
                  </div>

                  <Select value={timerProject} onValueChange={setTimerProject}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {filteredTasks.length > 0 && (
                    <Select value={timerTask} onValueChange={setTimerTask}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select task (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No task</SelectItem>
                        {filteredTasks.map(task => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Button
                    onClick={handleStartTimer}
                    className="w-full bg-green-600 hover:bg-green-700 h-10"
                    disabled={!timerProject}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Timer
                  </Button>
                </div>

                {/* Quick Create Section */}
                <div className="border-t pt-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Create</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3 px-2"
                      onClick={() => setActiveDialog('task')}
                    >
                      <CheckCircle className="w-5 h-5 mb-1 text-indigo-600" />
                      <span className="text-xs">Task</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3 px-2"
                      onClick={() => setActiveDialog('project')}
                    >
                      <Briefcase className="w-5 h-5 mb-1 text-indigo-600" />
                      <span className="text-xs">Project</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3 px-2"
                      onClick={() => setActiveDialog('account')}
                    >
                      <Building2 className="w-5 h-5 mb-1 text-indigo-600" />
                      <span className="text-xs">Account</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Quick Task Dialog */}
      <Dialog open={activeDialog === 'task'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>Add a task to a project</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select
                value={quickTaskData.project_id}
                onValueChange={(value) => setQuickTaskData({...quickTaskData, project_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Task Title *</Label>
              <Input
                value={quickTaskData.title}
                onChange={(e) => setQuickTaskData({...quickTaskData, title: e.target.value})}
                placeholder="What needs to be done?"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quickTaskData.title && quickTaskData.project_id) {
                    handleQuickTask();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
              <Button
                onClick={handleQuickTask}
                disabled={!quickTaskData.title || !quickTaskData.project_id}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Create Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Project Dialog */}
      <Dialog open={activeDialog === 'project'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a new project</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Project Name *</Label>
              <Input
                value={quickProjectData.name}
                onChange={(e) => setQuickProjectData({...quickProjectData, name: e.target.value})}
                placeholder="Enter project name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quickProjectData.name) {
                    handleQuickProject();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Account (Optional)</Label>
              <Select
                value={quickProjectData.account_id}
                onValueChange={(value) => setQuickProjectData({...quickProjectData, account_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account (or leave for internal)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Internal Project</SelectItem>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
              <Button
                onClick={handleQuickProject}
                disabled={!quickProjectData.name}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Create Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Account Dialog */}
      <Dialog open={activeDialog === 'account'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Account</DialogTitle>
            <DialogDescription>Add a new client account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={quickAccountData.company_name}
                onChange={(e) => setQuickAccountData({...quickAccountData, company_name: e.target.value})}
                placeholder="Enter company name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quickAccountData.company_name) {
                    handleQuickAccount();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
              <Button
                onClick={handleQuickAccount}
                disabled={!quickAccountData.company_name}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Create Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
