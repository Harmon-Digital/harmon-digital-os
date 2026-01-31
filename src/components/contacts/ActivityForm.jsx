import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ActivityForm({ activity, contactId, accountId, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(activity || {
    contact_id: contactId,
    account_id: accountId,
    type: "note",
    subject: "",
    description: "",
    date: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:MM format
    duration_minutes: 0,
    outcome: "",
    next_action: "",
    next_action_date: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Convert empty strings to null for optional fields
    const cleanedData = {
      ...formData,
      contact_id: formData.contact_id || null,
      account_id: formData.account_id || null,
      description: formData.description || null,
      outcome: formData.outcome || null,
      next_action: formData.next_action || null,
      next_action_date: formData.next_action_date || null,
    };
    onSubmit(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Activity Type *</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">📧 Email</SelectItem>
              <SelectItem value="phone_call">📞 Phone Call</SelectItem>
              <SelectItem value="meeting">👥 Meeting</SelectItem>
              <SelectItem value="note">📝 Note</SelectItem>
              <SelectItem value="task">✅ Task</SelectItem>
              <SelectItem value="other">📋 Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date & Time *</Label>
          <Input
            id="date"
            type="datetime-local"
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject *</Label>
        <Input
          id="subject"
          value={formData.subject}
          onChange={(e) => setFormData({...formData, subject: e.target.value})}
          placeholder="e.g., Follow-up call about proposal"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          rows={4}
          placeholder="Details about this activity..."
        />
      </div>

      {(formData.type === 'phone_call' || formData.type === 'meeting') && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="duration_minutes">Duration (minutes)</Label>
            <Input
              id="duration_minutes"
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value) || 0})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="outcome">Outcome</Label>
            <Select value={formData.outcome} onValueChange={(value) => setFormData({...formData, outcome: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="successful">✅ Successful</SelectItem>
                <SelectItem value="no_answer">❌ No Answer</SelectItem>
                <SelectItem value="left_voicemail">📧 Left Voicemail</SelectItem>
                <SelectItem value="follow_up_needed">🔄 Follow-up Needed</SelectItem>
                <SelectItem value="completed">✓ Completed</SelectItem>
                <SelectItem value="cancelled">🚫 Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="next_action">Next Action</Label>
        <Input
          id="next_action"
          value={formData.next_action}
          onChange={(e) => setFormData({...formData, next_action: e.target.value})}
          placeholder="e.g., Send proposal document"
        />
      </div>

      {formData.next_action && (
        <div className="space-y-2">
          <Label htmlFor="next_action_date">Next Action Date</Label>
          <Input
            id="next_action_date"
            type="date"
            value={formData.next_action_date}
            onChange={(e) => setFormData({...formData, next_action_date: e.target.value})}
          />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {activity ? "Update" : "Create"} Activity
        </Button>
      </div>
    </form>
  );
}