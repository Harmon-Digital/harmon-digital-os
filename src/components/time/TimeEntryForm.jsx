import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Info } from "lucide-react";

// Helper function to convert ISO datetime string to HH:mm format
const extractTimeFromISO = (isoString) => {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (e) {
    return isoString; // Return as-is if it's already in HH:mm format
  }
};

export default function TimeEntryForm({ timeEntry, projects, tasks, teamMembers, currentTeamMember, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(
    timeEntry ? {
      ...timeEntry,
      start_time: extractTimeFromISO(timeEntry.start_time),
      end_time: extractTimeFromISO(timeEntry.end_time),
    } : {
      project_id: "",
      task_id: "",
      team_member_id: currentTeamMember?.id || "",
      date: new Date().toISOString().split('T')[0],
      start_time: "",
      end_time: "",
      hours: 0,
      description: "",
      billable: true,
    }
  );

  const [filteredTasks, setFilteredTasks] = useState([]);
  const [monthlyHoursData, setMonthlyHoursData] = useState(null);
  const [loadingMonthlyData, setLoadingMonthlyData] = useState(false);

  useEffect(() => {
    if (formData.project_id) {
      setFilteredTasks(tasks.filter(t => t.project_id === formData.project_id));
      loadMonthlyRetainerData(formData.project_id, formData.date);
    } else {
      setFilteredTasks([]);
      setMonthlyHoursData(null);
    }
  }, [formData.project_id, formData.date, tasks]);

  // Calculate hours when start/end time changes
  useEffect(() => {
    if (formData.start_time && formData.end_time) {
      const start = new Date(`${formData.date}T${formData.start_time}`);
      const end = new Date(`${formData.date}T${formData.end_time}`);
      
      if (end > start) {
        const hours = (end - start) / (1000 * 60 * 60); // Convert ms to hours
        setFormData(prev => ({ ...prev, hours: Math.round(hours * 100) / 100 })); // Round to 2 decimals
      }
    }
  }, [formData.start_time, formData.end_time, formData.date]);

  const loadMonthlyRetainerData = async (projectId, date) => {
    setLoadingMonthlyData(true);
    try {
      const project = projects.find(p => p.id === projectId);
      
      if (project?.billing_type === 'retainer' && project.budget_hours) {
        // Get the month from the selected date
        const selectedDate = new Date(date);
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        
        // Get start and end of month
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
        
        // Fetch all time entries for this project
        const allTimeEntries = await base44.entities.TimeEntry.list();
        
        // Filter to current month for this project
        const monthlyEntries = allTimeEntries.filter(entry => {
          if (entry.project_id !== projectId) return false;
          // Skip the entry we're editing
          if (timeEntry && entry.id === timeEntry.id) return false;
          
          const entryDate = new Date(entry.date);
          return entryDate >= startOfMonth && entryDate <= endOfMonth;
        });
        
        const hoursUsed = monthlyEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
        
        setMonthlyHoursData({
          project: project,
          month: startOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          hoursUsed: hoursUsed,
          monthlyBudget: project.budget_hours,
          hoursRemaining: project.budget_hours - hoursUsed,
          isOverBudget: hoursUsed >= project.budget_hours
        });
      } else {
        setMonthlyHoursData(null);
      }
    } catch (error) {
      console.error("Error loading monthly retainer data:", error);
    } finally {
      setLoadingMonthlyData(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Ensure hours is calculated
    if (!formData.hours && formData.start_time && formData.end_time) {
      const start = new Date(`${formData.date}T${formData.start_time}`);
      const end = new Date(`${formData.date}T${formData.end_time}`);
      if (end > start) {
        formData.hours = Math.round((end - start) / (1000 * 60 * 60) * 100) / 100;
      }
    }
    
    // Warning if adding time to over-budget retainer project
    if (monthlyHoursData && monthlyHoursData.isOverBudget) {
      const confirmed = confirm(
        `⚠️ WARNING: This retainer project is already over budget for ${monthlyHoursData.month}!\n\n` +
        `Budget: ${monthlyHoursData.monthlyBudget}h\n` +
        `Already used: ${monthlyHoursData.hoursUsed}h\n` +
        `Adding: ${formData.hours}h\n` +
        `New total: ${(monthlyHoursData.hoursUsed + formData.hours).toFixed(1)}h\n\n` +
        `Do you want to continue?`
      );
      
      if (!confirmed) return;
    } else if (monthlyHoursData && (monthlyHoursData.hoursUsed + formData.hours) > monthlyHoursData.monthlyBudget) {
      const confirmed = confirm(
        `⚠️ WARNING: Adding this time will exceed the monthly budget!\n\n` +
        `Budget: ${monthlyHoursData.monthlyBudget}h\n` +
        `Currently used: ${monthlyHoursData.hoursUsed}h\n` +
        `Adding: ${formData.hours}h\n` +
        `New total: ${(monthlyHoursData.hoursUsed + formData.hours).toFixed(1)}h (${((monthlyHoursData.hoursUsed + formData.hours) - monthlyHoursData.monthlyBudget).toFixed(1)}h over)\n\n` +
        `Do you want to continue?`
      );
      
      if (!confirmed) return;
    }
    
    onSubmit(formData);
  };

  // Convert existing hours to start/end if editing old entry (legacy entries without start/end times)
  useEffect(() => {
    if (timeEntry && timeEntry.hours && !timeEntry.start_time) {
      // Default start time to 9 AM if not set
      const startTime = "09:00";
      const start = new Date(`${formData.date}T${startTime}`);
      const end = new Date(start.getTime() + timeEntry.hours * 60 * 60 * 1000);
      
      setFormData(prev => ({
        ...prev,
        start_time: startTime,
        end_time: end.toTimeString().slice(0, 5),
      }));
    }
  }, [timeEntry]);

  const willExceedBudget = monthlyHoursData && formData.hours > 0 && 
    (monthlyHoursData.hoursUsed + formData.hours) > monthlyHoursData.monthlyBudget;
  
  const isAlreadyOver = monthlyHoursData && monthlyHoursData.isOverBudget;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label>Date *</Label>
        <Input
          type="date"
          value={formData.date}
          onChange={(e) => handleChange("date", e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Time *</Label>
          <Input
            type="time"
            value={formData.start_time}
            onChange={(e) => handleChange("start_time", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>End Time *</Label>
          <Input
            type="time"
            value={formData.end_time}
            onChange={(e) => handleChange("end_time", e.target.value)}
            required
          />
        </div>
      </div>

      {formData.start_time && formData.end_time && formData.hours > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <p className="text-sm font-semibold text-indigo-900">
            Total: {formData.hours} hours
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Project *</Label>
        <Select value={formData.project_id} onValueChange={(value) => handleChange("project_id", value)}>
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

      {/* Retainer Budget Warning */}
      {monthlyHoursData && !loadingMonthlyData && (
        <div className={`rounded-lg p-4 border ${
          isAlreadyOver 
            ? 'bg-red-50 border-red-200' 
            : willExceedBudget 
            ? 'bg-yellow-50 border-yellow-200' 
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex gap-3">
            {(isAlreadyOver || willExceedBudget) ? (
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                isAlreadyOver ? 'text-red-600' : 'text-yellow-600'
              }`} />
            ) : (
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
            )}
            <div className="flex-1">
              <p className={`font-semibold text-sm ${
                isAlreadyOver 
                  ? 'text-red-900' 
                  : willExceedBudget 
                  ? 'text-yellow-900' 
                  : 'text-blue-900'
              }`}>
                {isAlreadyOver && '⚠️ Retainer Over Budget'}
                {!isAlreadyOver && willExceedBudget && '⚠️ Will Exceed Retainer Budget'}
                {!isAlreadyOver && !willExceedBudget && 'Retainer Budget Status'}
              </p>
              <div className={`text-xs mt-2 space-y-1 ${
                isAlreadyOver 
                  ? 'text-red-800' 
                  : willExceedBudget 
                  ? 'text-yellow-800' 
                  : 'text-blue-800'
              }`}>
                <p className="font-semibold">{monthlyHoursData.month}</p>
                <p>Budget: {monthlyHoursData.monthlyBudget}h per month</p>
                <p>Used: {monthlyHoursData.hoursUsed.toFixed(1)}h</p>
                {formData.hours > 0 && (
                  <p>Adding: {formData.hours.toFixed(1)}h</p>
                )}
                {formData.hours > 0 && (
                  <p className="font-semibold pt-1 border-t border-current">
                    New Total: {(monthlyHoursData.hoursUsed + formData.hours).toFixed(1)}h
                    {willExceedBudget && ` (${((monthlyHoursData.hoursUsed + formData.hours) - monthlyHoursData.monthlyBudget).toFixed(1)}h over)`}
                  </p>
                )}
                {!formData.hours && monthlyHoursData.hoursRemaining > 0 && (
                  <p className="font-semibold">Remaining: {monthlyHoursData.hoursRemaining.toFixed(1)}h</p>
                )}
                {!formData.hours && monthlyHoursData.hoursRemaining <= 0 && (
                  <p className="font-semibold">Over budget by: {Math.abs(monthlyHoursData.hoursRemaining).toFixed(1)}h</p>
                )}
              </div>
              {isAlreadyOver && (
                <p className="text-xs mt-2 text-red-700 font-medium">
                  🚫 Consider not adding more time this month or discuss with the client
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {filteredTasks.length > 0 && (
        <div className="space-y-2">
          <Label>Task (Optional)</Label>
          <Select value={formData.task_id || ""} onValueChange={(value) => handleChange("task_id", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select task" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>None</SelectItem>
              {filteredTasks.map(task => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Team Member *</Label>
        <Select value={formData.team_member_id} onValueChange={(value) => handleChange("team_member_id", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select team member" />
          </SelectTrigger>
          <SelectContent>
            {teamMembers.filter(tm => tm.status === 'active').map(tm => (
              <SelectItem key={tm.id} value={tm.id}>
                {tm.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="What did you work on?"
          rows={3}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="billable"
          checked={formData.billable}
          onCheckedChange={(checked) => handleChange("billable", checked)}
        />
        <Label htmlFor="billable" className="cursor-pointer">
          Billable to client
        </Label>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {timeEntry ? "Update Entry" : "Log Time"}
        </Button>
      </div>
    </form>
  );
}