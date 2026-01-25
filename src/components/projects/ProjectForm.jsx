
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ProjectForm({ project, accounts, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(project || {
    name: "",
    account_id: "",
    description: "",
    status: "active",
    billing_type: "hourly",
    is_internal: false, // Added new field
    budget: 0,
    budget_hours: 0,
    start_date: "",
    end_date: "",
    project_type: "web_development",
    risk_level: "low"
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Project Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
          />
        </div>

        {/* New Project Type Selector (Client vs Internal) */}
        <div className="space-y-2">
          <Label htmlFor="is_internal">Project Category</Label>
          <Select 
            value={formData.is_internal ? "internal" : "client"} 
            onValueChange={(value) => {
              const isInternal = value === "internal";
              setFormData({
                ...formData, 
                is_internal: isInternal,
                // Set default values when switching project category
                billing_type: isInternal ? "internal" : "hourly", // "internal" billing type for internal projects
                project_type: isInternal ? "internal" : "web_development" // "internal" project type for internal projects
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Client Project</SelectItem>
              <SelectItem value="internal">Internal Project</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conditional rendering for Account ID */}
        {!formData.is_internal && (
          <div className="space-y-2">
            <Label htmlFor="account_id">Account *</Label>
            <Select 
              value={formData.account_id} 
              onValueChange={(value) => setFormData({...formData, account_id: value})}
              // Mark as required only for client projects
              required={!formData.is_internal}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Informational message for internal projects */}
        {formData.is_internal && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 Internal projects are for tracking time on non-billable company work like meetings, admin, and training.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conditional rendering for client-specific fields */}
        {!formData.is_internal && (
          <>
            <div className="space-y-2">
              <Label htmlFor="billing_type">Billing Type</Label>
              <Select value={formData.billing_type} onValueChange={(value) => setFormData({...formData, billing_type: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="fixed">Fixed Price</SelectItem>
                  <SelectItem value="retainer">Retainer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="project_type">Project Type</Label>
              <Select value={formData.project_type} onValueChange={(value) => setFormData({...formData, project_type: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web_development">Web Development</SelectItem>
                  <SelectItem value="mobile_app">Mobile App</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk_level">Risk Level</Label>
              <Select value={formData.risk_level} onValueChange={(value) => setFormData({...formData, risk_level: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input
                  id="budget"
                  type="number"
                  value={formData.budget}
                  onChange={(e) => setFormData({...formData, budget: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget_hours">Budget Hours</Label>
                <Input
                  id="budget_hours"
                  type="number"
                  value={formData.budget_hours}
                  onChange={(e) => setFormData({...formData, budget_hours: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                />
              </div>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            rows={3}
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {project ? "Update" : "Create"} Project
        </Button>
      </div>
    </form>
  );
}
