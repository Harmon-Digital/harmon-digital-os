import React, { useState, useEffect } from "react";
import { api } from "@/api/legacyClient";
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
import { Plus, Clock, Play, Pause, Square, CheckCircle, Briefcase, Building2 } from "lucide-react";

export default function QuickActions() {
  const { user: authUser, userProfile } = useAuth();
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

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [currentTeamMember, setCurrentTeamMember] = useState(null);
  
  const [activeDialog, setActiveDialog] = useState(null);
  const [quickTaskData, setQuickTaskData] = useState({ title: "", project_id: "" });
  const [quickProjectData, setQuickProjectData] = useState({ name: "", account_id: "" });
  const [quickAccountData, setQuickAccountData] = useState({ company_name: "" });

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

  const loadData = async () => {
    try {
      const [projectsData, tasksData, accountsData, teamMembersData] = await Promise.all([
        api.entities.Project.list(),
        api.entities.Task.list(),
        api.entities.Account.list(),
        api.entities.TeamMember.list(),
      ]);

      setProjects(projectsData);
      setTasks(tasksData);
      setAccounts(accountsData);

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
      alert("Please select a project first");
      return;
    }
    
    const now = Date.now();
    const actualStart = new Date(now); // Real wall-clock time
    
    setStartTime(now);
    setActualStartTime(actualStart.toISOString());
    setPausedDuration(0);
    setElapsedTime(0);
    setTimerRunning(true);
    setTimerPaused(false);
    setIsOpen(false);
  };

  const handlePauseTimer = () => {
    if (!timerPaused) {
      // Pausing
      setPausedDuration(prev => prev + (Date.now() - startTime));
      setTimerPaused(true);
    } else {
      // Resuming
      setStartTime(Date.now());
      setTimerPaused(false);
    }
  };

  const handleStopTimer = async () => {
    if (!timerProject || !currentTeamMember || !actualStartTime) {
      alert("Cannot save time entry: missing project, team member, or start time");
      return;
    }

    // Calculate final time
    const now = Date.now();
    const totalMs = timerPaused 
      ? pausedDuration 
      : (now - startTime + pausedDuration);
    const hours = Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;

    if (hours <= 0) {
      alert("Timer must run for at least some time");
      return;
    }

    try {
      // Use the actual start time we saved, and current time as end time
      const endTime = new Date(now);
      
      await api.entities.TimeEntry.create({
        project_id: timerProject,
        task_id: timerTask || null,
        team_member_id: currentTeamMember.id,
        date: new Date(actualStartTime).toISOString().split('T')[0],
        start_time: actualStartTime, // Use the actual wall-clock start time
        end_time: endTime.toISOString(),
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
      
      alert(`Time entry saved: ${hours} hours`);
    } catch (error) {
      console.error("Error saving time entry:", error);
      alert("Failed to save time entry");
    }
  };

  const handleQuickTask = async () => {
    if (!quickTaskData.title || !quickTaskData.project_id) return;
    
    try {
      await api.entities.Task.create({
        title: quickTaskData.title,
        project_id: quickTaskData.project_id,
        status: "todo",
        priority: "medium",
      });
      
      setQuickTaskData({ title: "", project_id: "" });
      setActiveDialog(null);
      loadData();
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const handleQuickProject = async () => {
    if (!quickProjectData.name) return;
    
    try {
      await api.entities.Project.create({
        name: quickProjectData.name,
        account_id: quickProjectData.account_id || null,
        status: "active",
        billing_type: "hourly",
      });
      
      setQuickProjectData({ name: "", account_id: "" });
      setActiveDialog(null);
      loadData();
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  const handleQuickAccount = async () => {
    if (!quickAccountData.company_name) return;
    
    try {
      await api.entities.Account.create({
        company_name: quickAccountData.company_name,
        status: "active",
      });
      
      setQuickAccountData({ company_name: "" });
      setActiveDialog(null);
      loadData();
    } catch (error) {
      console.error("Error creating account:", error);
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

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              className={`rounded-full w-14 h-14 shadow-lg ${
                timerRunning 
                  ? timerPaused
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-green-600 hover:bg-green-700 animate-pulse'
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
          <PopoverContent className="w-80" align="end">
            {timerRunning ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-600 mb-2">
                    {formatTime(elapsedTime)}
                  </div>
                  <p className="text-sm text-gray-600">
                    {projects.find(p => p.id === timerProject)?.name || "Unknown Project"}
                  </p>
                  {timerTask && (
                    <p className="text-xs text-gray-500">
                      {tasks.find(t => t.id === timerTask)?.title}
                    </p>
                  )}
                  {actualStartTime && (
                    <p className="text-xs text-gray-500 mt-2">
                      Started at {formatDateTime(actualStartTime)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={timerDescription}
                    onChange={(e) => setTimerDescription(e.target.value)}
                    placeholder="What are you working on?"
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
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
                    variant="destructive"
                    className="flex-1"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop & Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Quick Actions</h3>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Start Timer</Label>
                    <Select value={timerProject} onValueChange={setTimerProject}>
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

                  {filteredTasks.length > 0 && (
                    <Select value={timerTask} onValueChange={setTimerTask}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select task (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>No task</SelectItem>
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
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={!timerProject}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Timer
                  </Button>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <p className="text-sm font-semibold text-gray-600">Quick Create</p>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setActiveDialog('task')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    New Task
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setActiveDialog('project')}
                  >
                    <Briefcase className="w-4 h-4 mr-2" />
                    New Project
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setActiveDialog('account')}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    New Account
                  </Button>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Quick Task Dialog */}
      <Dialog open={activeDialog === 'task'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Create Task</DialogTitle>
            <DialogDescription>Add a new task to a project</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Task Title *</Label>
              <Input
                value={quickTaskData.title}
                onChange={(e) => setQuickTaskData({...quickTaskData, title: e.target.value})}
                placeholder="What needs to be done?"
              />
            </div>
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
              <Button onClick={handleQuickTask} disabled={!quickTaskData.title || !quickTaskData.project_id}>
                Create Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Project Dialog */}
      <Dialog open={activeDialog === 'project'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Create Project</DialogTitle>
            <DialogDescription>Add a new project</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project Name *</Label>
              <Input
                value={quickProjectData.name}
                onChange={(e) => setQuickProjectData({...quickProjectData, name: e.target.value})}
                placeholder="Enter project name"
              />
            </div>
            <div className="space-y-2">
              <Label>Account (Optional)</Label>
              <Select
                value={quickProjectData.account_id}
                onValueChange={(value) => setQuickProjectData({...quickProjectData, account_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Internal Project</SelectItem>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
              <Button onClick={handleQuickProject} disabled={!quickProjectData.name}>
                Create Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Account Dialog */}
      <Dialog open={activeDialog === 'account'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Create Account</DialogTitle>
            <DialogDescription>Add a new client account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={quickAccountData.company_name}
                onChange={(e) => setQuickAccountData({...quickAccountData, company_name: e.target.value})}
                placeholder="Enter company name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
              <Button onClick={handleQuickAccount} disabled={!quickAccountData.company_name}>
                Create Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}