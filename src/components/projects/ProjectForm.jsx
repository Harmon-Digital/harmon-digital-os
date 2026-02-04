import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Clock, TrendingUp, Building2, Plus, X, Loader2 } from "lucide-react";
import { Account } from "@/api/entities";

export default function ProjectForm({ project, accounts: initialAccounts, onSubmit, onCancel }) {
  const [accounts, setAccounts] = useState(initialAccounts || []);
  const [formData, setFormData] = useState(project || {
    name: "",
    account_id: "",
    description: "",
    status: "active",
    billing_type: "retainer",
    is_internal: false,
    // Hourly
    hourly_rate: 0,
    // Retainer
    monthly_retainer: 0,
    retainer_hours_included: 0,
    // Exit
    valuation_percentage: 8,
    baseline_valuation: 0,
    exit_target_date: "",
    engagement_months: 3,
    // General
    start_date: "",
    end_date: "",
    project_type: "consulting",
  });

  // New account creation state
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [newAccountData, setNewAccountData] = useState({ company_name: "", website: "" });
  const [creatingAccount, setCreatingAccount] = useState(false);

  const handleCreateAccount = async () => {
    if (!newAccountData.company_name.trim()) return;

    setCreatingAccount(true);
    try {
      const newAccount = await Account.create({
        company_name: newAccountData.company_name,
        website: newAccountData.website || null,
        status: "active"
      });

      // Add to local accounts list and select it
      setAccounts([...accounts, newAccount]);
      setFormData({ ...formData, account_id: newAccount.id, is_internal: false });

      // Reset and close form
      setNewAccountData({ company_name: "", website: "" });
      setShowNewAccountForm(false);
    } catch (error) {
      console.error("Error creating account:", error);
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const isInternal = !formData.account_id;
    const cleanedData = {
      ...formData,
      account_id: formData.account_id || null,
      is_internal: isInternal,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      exit_target_date: formData.exit_target_date || null,
      description: formData.description || null,
    };
    onSubmit(cleanedData);
  };

  const billingOptions = [
    { value: "retainer", label: "Retainer", icon: Building2, description: "Monthly recurring" },
    { value: "hourly", label: "Hourly", icon: Clock, description: "Bill by the hour" },
    { value: "exit", label: "Exit", icon: TrendingUp, description: "Retainer + Success Fee" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Project Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Project Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          placeholder="e.g., Website Redesign"
          required
        />
      </div>

      {/* Account */}
      <div className="space-y-2">
        <Label htmlFor="account_id">Client Account</Label>
        {!showNewAccountForm ? (
          <div className="flex gap-2">
            <Select
              value={formData.account_id || "none"}
              onValueChange={(value) => setFormData({
                ...formData,
                account_id: value === "none" ? "" : value,
                is_internal: value === "none"
              })}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Account (Internal)</SelectItem>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowNewAccountForm(true)}
              title="Create new account"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="p-3 border rounded-lg bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">New Client Account</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewAccountForm(false);
                  setNewAccountData({ company_name: "", website: "" });
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Company name *"
                value={newAccountData.company_name}
                onChange={(e) => setNewAccountData({ ...newAccountData, company_name: e.target.value })}
                autoFocus
              />
              <Input
                placeholder="Website (optional)"
                value={newAccountData.website}
                onChange={(e) => setNewAccountData({ ...newAccountData, website: e.target.value })}
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateAccount}
              disabled={!newAccountData.company_name.trim() || creatingAccount}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {creatingAccount ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Account
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Billing Type - Visual Cards (only for client projects) */}
      {formData.account_id && (
        <div className="space-y-2">
          <Label>Billing Type</Label>
          <div className="grid grid-cols-3 gap-3">
            {billingOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = formData.billing_type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({...formData, billing_type: option.value})}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${isSelected ? "text-indigo-600" : "text-gray-400"}`} />
                  <div className={`font-medium ${isSelected ? "text-indigo-900" : "text-gray-900"}`}>
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Billing Type Specific Fields (only for client projects) */}
      {formData.account_id && (
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        {formData.billing_type === "hourly" && (
          <div className="space-y-2">
            <Label htmlFor="hourly_rate">Hourly Rate</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                className="pl-9"
                value={formData.hourly_rate || ""}
                onChange={(e) => setFormData({...formData, hourly_rate: parseFloat(e.target.value) || 0})}
                placeholder="150"
              />
            </div>
          </div>
        )}

        {formData.billing_type === "retainer" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthly_retainer">Monthly Retainer</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="monthly_retainer"
                    type="number"
                    step="0.01"
                    className="pl-9"
                    value={formData.monthly_retainer || ""}
                    onChange={(e) => setFormData({...formData, monthly_retainer: parseFloat(e.target.value) || 0})}
                    placeholder="2500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="retainer_hours_included">Hours Included</Label>
                <Input
                  id="retainer_hours_included"
                  type="number"
                  value={formData.retainer_hours_included || ""}
                  onChange={(e) => setFormData({...formData, retainer_hours_included: parseFloat(e.target.value) || 0})}
                  placeholder="20 (optional)"
                />
              </div>
            </div>
          </>
        )}

        {formData.billing_type === "exit" && (
          <>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-2">
              <p className="text-sm text-green-800">
                <strong>Exit Systematization:</strong> Monthly retainer + success fee based on valuation increase at sale.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthly_retainer">Monthly Retainer</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="monthly_retainer"
                    type="number"
                    step="0.01"
                    className="pl-9"
                    value={formData.monthly_retainer || ""}
                    onChange={(e) => setFormData({...formData, monthly_retainer: parseFloat(e.target.value) || 0})}
                    placeholder="2500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valuation_percentage">Success Fee %</Label>
                <div className="relative">
                  <Input
                    id="valuation_percentage"
                    type="number"
                    step="0.1"
                    value={formData.valuation_percentage || ""}
                    onChange={(e) => setFormData({...formData, valuation_percentage: parseFloat(e.target.value) || 0})}
                    placeholder="8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="baseline_valuation">Baseline Valuation</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="baseline_valuation"
                    type="number"
                    className="pl-9"
                    value={formData.baseline_valuation || ""}
                    onChange={(e) => setFormData({...formData, baseline_valuation: parseFloat(e.target.value) || 0})}
                    placeholder="2000000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="engagement_months">Engagement Length</Label>
                <Select
                  value={String(formData.engagement_months || 3)}
                  onValueChange={(value) => setFormData({...formData, engagement_months: parseInt(value)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 month</SelectItem>
                    <SelectItem value="2">2 months</SelectItem>
                    <SelectItem value="3">3 months</SelectItem>
                    <SelectItem value="6">6 months</SelectItem>
                    <SelectItem value="12">12 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exit_target_date">Expected Exit Date</Label>
              <Input
                id="exit_target_date"
                type="date"
                value={formData.exit_target_date || ""}
                onChange={(e) => setFormData({...formData, exit_target_date: e.target.value})}
              />
            </div>
          </>
        )}
      </div>
      )}

      {/* Project Type */}
      <div className="space-y-2">
        <Label htmlFor="project_type">Project Type</Label>
        <Select value={formData.project_type} onValueChange={(value) => setFormData({...formData, project_type: value})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="exit_systematization">Exit Systematization</SelectItem>
            <SelectItem value="web_development">Web Development</SelectItem>
            <SelectItem value="consulting">Consulting</SelectItem>
            <SelectItem value="automation">Automation</SelectItem>
            <SelectItem value="design">Design</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="marketing">Marketing</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status & Dates */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="start_date">Start Date</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date || ""}
            onChange={(e) => setFormData({...formData, start_date: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End Date</Label>
          <Input
            id="end_date"
            type="date"
            value={formData.end_date || ""}
            onChange={(e) => setFormData({...formData, end_date: e.target.value})}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Notes</Label>
        <Textarea
          id="description"
          value={formData.description || ""}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          rows={2}
          placeholder="Any additional details..."
        />
      </div>

      {/* Actions */}
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
