import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PaymentForm({ payment, teamMembers, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(payment || {
    team_member_id: "",
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    period_start: "",
    period_end: "",
    payment_method: "bank_transfer",
    status: "pending",
    notes: "",
    hours_worked: 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="team_member_id">Team Member *</Label>
          <Select value={formData.team_member_id} onValueChange={(value) => setFormData({...formData, team_member_id: value})}>
            <SelectTrigger>
              <SelectValue placeholder="Select team member" />
            </SelectTrigger>
            <SelectContent>
              {teamMembers.filter(tm => tm.status === 'active').map(tm => (
                <SelectItem key={tm.id} value={tm.id}>
                  {tm.full_name} - {tm.role.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hours_worked">Hours Worked</Label>
            <Input
              id="hours_worked"
              type="number"
              step="0.5"
              value={formData.hours_worked}
              onChange={(e) => setFormData({...formData, hours_worked: parseFloat(e.target.value) || 0})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_date">Payment Date *</Label>
          <Input
            id="payment_date"
            type="date"
            value={formData.payment_date}
            onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="period_start">Period Start</Label>
            <Input
              id="period_start"
              type="date"
              value={formData.period_start}
              onChange={(e) => setFormData({...formData, period_start: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period_end">Period End</Label>
            <Input
              id="period_end"
              type="date"
              value={formData.period_end}
              onChange={(e) => setFormData({...formData, period_end: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment Method</Label>
            <Select value={formData.payment_method} onValueChange={(value) => setFormData({...formData, payment_method: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            rows={3}
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {payment ? "Update" : "Create"} Payment
        </Button>
      </div>
    </form>
  );
}