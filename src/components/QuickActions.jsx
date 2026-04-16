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
  const [pauseStartTime, setPauseStartTime] = useState(null);
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
  }, [timerRunning, timerPaused, startTime, actualStartTime, pausedDuration, pauseStartTime, timerProject, timerTask, timerDescription]);

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
      setPauseStartTime(state.pauseStartTime || null);
      setTimerProject(state.project || "");
      setTimerTask(state.task || "");
      setTimerDescription(state.description || "");

      // Restore elapsed time so the display is correct on reload
      if (state.running && state.startTime) {
        const storedPausedDuration = state.pausedDuration || 0;
        if (state.paused && state.pauseStartTime) {
          // Timer was paused: active time = pauseStart - start - totalPaused
          setElapsedTime(Math.floor((state.pauseStartTime - state.startTime - storedPausedDuration) / 1000));
        } else {
          // Timer is running: active time = now - start - totalPaused
          setElapsedTime(Math.floor((Date.now() - state.startTime - storedPausedDuration) / 1000));
        }
      }
    }
  };

  const saveTimerState = () => {
    localStorage.setItem('quickActionsTimer', JSON.stringify({
      running: timerRunning,
      paused: timerPaused,
      startTime,
      actualStartTime,
      pausedDuration,
      pauseStartTime,
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
      // Record when we paused so we can calculate paused duration on resume
      setPauseStartTime(Date.now());
      setTimerPaused(true);
      showToast("Timer paused");
    } else {
      // Add the time spent paused to pausedDuration
      setPausedDuration(prev => prev + (pauseStartTime ? (Date.now() - pauseStartTime) : 0));
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
    // Total elapsed minus time spent paused
    const currentPausedDuration = timerPaused
      ? pausedDuration + (now - (pauseStartTime || now))
      : pausedDuration;
    const totalMs = now - startTime - currentPausedDuration;
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
        task_id: timerTask && timerTask !== "none" ? timerTask : null,
        team_member_id: currentTeamMember.id,
        date: `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`,
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
        account_id: quickProjectData.account_id && quickProjectData.account_id !== "none" ? quickProjectData.account_id : null,
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
          className="fixed bottom-6 z-50 cursor-pointer transition-all duration-300"
          style={{ right: "calc(var(--qa-right, 24px) + 72px)" }}
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

      <div className="fixed bottom-6 z-50 transition-all duration-300" style={{ right: "var(--qa-right, 24px)" }}>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={timerRunning ? "Open timer" : "Quick actions"}
              className={`rounded-full w-11 h-11 shadow-md ring-1 transition-all flex items-center justify-center ${
                timerRunning
                  ? timerPaused
                    ? 'bg-yellow-500 hover:bg-yellow-600 ring-yellow-400/40'
                    : 'bg-green-500 hover:bg-green-600 ring-green-400/40'
                  : 'bg-gray-900 hover:bg-gray-800 ring-black/10'
              }`}
            >
              {timerRunning ? (
                <Clock className="w-4 h-4 text-white" />
              ) : (
                <Plus className="w-4 h-4 text-white" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end" sideOffset={8}>
            {timerRunning ? (
              <div className="p-3 space-y-3">
                {/* Timer header */}
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-medium uppercase tracking-wide ${timerPaused ? 'text-yellow-600' : 'text-green-600'}`}>
                    {timerPaused ? 'Paused' : 'Recording'}
                  </span>
                  <button onClick={handleDiscardTimer} className="p-0.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className={`text-3xl font-mono font-bold tabular-nums ${timerPaused ? 'text-yellow-700' : 'text-green-700'}`}>
                  {formatTime(elapsedTime)}
                </div>

                {/* Project/task info */}
                <div>
                  <p className="text-[13px] font-medium text-gray-900">{currentProjectName}</p>
                  {timerTask && <p className="text-[12px] text-gray-500">{tasks.find(t => t.id === timerTask)?.title}</p>}
                  {actualStartTime && <p className="text-[11px] text-gray-400">Started {formatDateTime(actualStartTime)}</p>}
                </div>

                {/* Description */}
                <Textarea
                  value={timerDescription}
                  onChange={(e) => setTimerDescription(e.target.value)}
                  placeholder="What are you working on?"
                  rows={2}
                  className="resize-none text-[13px] border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-300"
                />

                {/* Actions */}
                <div className="flex gap-1.5">
                  <Button onClick={handlePauseTimer} variant="outline" size="sm" className="flex-1 h-7 text-[13px]">
                    {timerPaused ? <><Play className="w-3.5 h-3.5 mr-1" /> Resume</> : <><Pause className="w-3.5 h-3.5 mr-1" /> Pause</>}
                  </Button>
                  <Button onClick={handleStopTimer} size="sm" className="flex-1 h-7 text-[13px] bg-gray-900 hover:bg-gray-800 text-white" disabled={saving}>
                    <Square className="w-3.5 h-3.5 mr-1" /> {saving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {/* Timer section */}
                <div className="space-y-2">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Timer</div>
                  <Select value={timerProject} onValueChange={setTimerProject}>
                    <SelectTrigger className="h-8 text-[13px]"><SelectValue placeholder="Project…" /></SelectTrigger>
                    <SelectContent>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filteredTasks.length > 0 && (
                    <Select value={timerTask} onValueChange={setTimerTask}>
                      <SelectTrigger className="h-8 text-[13px]"><SelectValue placeholder="Task (optional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No task</SelectItem>
                        {filteredTasks.map(task => (
                          <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    onClick={handleStartTimer}
                    size="sm"
                    className="w-full h-7 text-[13px] bg-green-600 hover:bg-green-700 text-white"
                    disabled={!timerProject}
                  >
                    <Play className="w-3.5 h-3.5 mr-1" /> Start
                  </Button>
                </div>

                {/* Quick create */}
                <div className="border-t border-gray-100 pt-2.5 space-y-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Quick create</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: 'task', icon: CheckCircle, label: 'Task' },
                      { key: 'project', icon: Briefcase, label: 'Project' },
                      { key: 'account', icon: Building2, label: 'Account' },
                    ].map(item => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveDialog(item.key)}
                        className="flex flex-col items-center gap-1 py-2 px-1.5 rounded-md border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                      >
                        <item.icon className="w-4 h-4 text-gray-500" />
                        <span className="text-[11px] text-gray-700">{item.label}</span>
                      </button>
                    ))}
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
                className="bg-gray-900 hover:bg-gray-800 text-white"
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
                  <SelectItem value="none">Internal Project</SelectItem>
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
                className="bg-gray-900 hover:bg-gray-800 text-white"
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
                className="bg-gray-900 hover:bg-gray-800 text-white"
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
