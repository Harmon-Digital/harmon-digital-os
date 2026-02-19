import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TaskForm({ task, projects, teamMembers = [], onSubmit, onCancel }) {
  const [formData, setFormData] = useState(task || {
    title: "",
    description: "",
    project_id: "",
    assigned_to: "",
    status: "todo",
    priority: "medium",
    estimated_hours: 0,
    due_date: "",
    recurrence_enabled: false,
    recurrence_mode: "on_complete",
    recurrence_frequency: "weekly",
    recurrence_interval: 1,
    recurrence_end_date: "",
    recurrence_count: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Convert empty strings to null for optional fields
    const cleanedData = {
      ...formData,
      project_id: formData.project_id || null,
      assigned_to: formData.assigned_to || null,
      due_date: formData.due_date || null,
      recurrence_enabled: !!formData.recurrence_enabled,
      recurrence_mode: formData.recurrence_enabled ? (formData.recurrence_mode || 'on_complete') : 'on_complete',
      recurrence_frequency: formData.recurrence_enabled ? formData.recurrence_frequency : null,
      recurrence_interval: formData.recurrence_enabled ? Math.max(1, parseInt(formData.recurrence_interval || 1, 10)) : 1,
      recurrence_end_date: formData.recurrence_enabled && formData.recurrence_end_date ? formData.recurrence_end_date : null,
      recurrence_count: formData.recurrence_enabled && formData.recurrence_count ? Math.max(1, parseInt(formData.recurrence_count, 10)) : null,
    };
    onSubmit(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Task Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project_id">Project</Label>
          <Select value={formData.project_id || "none"} onValueChange={(value) => setFormData({...formData, project_id: value === "none" ? null : value})}>
            <SelectTrigger>
              <SelectValue placeholder="Select project (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Project</SelectItem>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {teamMembers && teamMembers.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assigned To</Label>
            <Select value={formData.assigned_to || ""} onValueChange={(value) => setFormData({...formData, assigned_to: value})}>
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
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="estimated_hours">Est. Hours</Label>
            <Input
              id="estimated_hours"
              type="number"
              step="0.5"
              value={formData.estimated_hours}
              onChange={(e) => setFormData({...formData, estimated_hours: parseFloat(e.target.value) || 0})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="date"
              value={formData.due_date || ""}
              onChange={(e) => setFormData({...formData, due_date: e.target.value})}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="recurrence_enabled" className="text-sm font-medium">Recurring Task</Label>
            <input
              id="recurrence_enabled"
              type="checkbox"
              checked={!!formData.recurrence_enabled}
              onChange={(e) => setFormData({ ...formData, recurrence_enabled: e.target.checked })}
              className="h-4 w-4"
            />
          </div>

          {formData.recurrence_enabled && (
            <>
              <div className="space-y-2">
                <Label>Generation Mode</Label>
                <Select
                  value={formData.recurrence_mode || "on_complete"}
                  onValueChange={(value) => setFormData({ ...formData, recurrence_mode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_complete">Create next when completed</SelectItem>
                    <SelectItem value="calendar">Calendar schedule (auto-create by date)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={formData.recurrence_frequency || "weekly"}
                    onValueChange={(value) => setFormData({ ...formData, recurrence_frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Every</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.recurrence_interval || 1}
                    onChange={(e) => setFormData({ ...formData, recurrence_interval: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>End Date (optional)</Label>
                  <Input
                    type="date"
                    value={formData.recurrence_end_date || ""}
                    onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Occurrences (optional)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.recurrence_count || ""}
                    onChange={(e) => setFormData({ ...formData, recurrence_count: e.target.value })}
                    placeholder="e.g. 12"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {formData.recurrence_mode === 'calendar'
                  ? 'Next tasks are generated by schedule (use cron to run generate_scheduled_recurring_tasks).'
                  : 'Next task is auto-created when this one is marked complete.'}
              </p>
            </>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {task ? "Update" : "Create"} Task
        </Button>
      </div>
    </form>
  );
}