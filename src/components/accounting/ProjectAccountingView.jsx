import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Clock, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ProjectAccountingView({ 
  projectId, 
  timeEntries, 
  teamMembers, 
  project 
}) {
  const [billingFilter, setBillingFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleToggleBilled = async (entryId, currentStatus) => {
    const entryToUpdate = timeEntries.find(e => e.id === entryId);
    if (!entryToUpdate) return;

    await base44.entities.TimeEntry.update(entryId, { ...entryToUpdate, client_billed: !currentStatus });
    window.location.reload();
  };

  const handleTogglePaid = async (entryId, currentStatus) => {
    const entryToUpdate = timeEntries.find(e => e.id === entryId);
    if (!entryToUpdate) return;

    await base44.entities.TimeEntry.update(entryId, { ...entryToUpdate, contractor_paid: !currentStatus });
    window.location.reload();
  };

  const filterByDateRange = (date) => {
    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    if (!startDate && !endDate) return true;

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (entryDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (entryDate > end) return false;
    }
    return true;
  };

  const filteredEntries = timeEntries.filter(entry => {
    if (!filterByDateRange(entry.date)) return false;
    if (billingFilter === "billed" && !entry.client_billed) return false;
    if (billingFilter === "unbilled" && entry.client_billed) return false;
    if (paymentFilter === "paid" && !entry.contractor_paid) return false;
    if (paymentFilter === "unpaid" && entry.contractor_paid) return false;
    return true;
  });

  const isProjectBillableToClient = (proj) => {
    if (!proj) return false;
    if (proj.is_internal || proj.billing_type === 'internal') return false;
    return true;
  };

  const projectRate = project?.hourly_rate || 0;
  const isRetainer = project?.billing_type === 'retainer';

  const totalHours = filteredEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const billableHours = filteredEntries.filter(e => e.billable).reduce((sum, entry) => sum + (entry.hours || 0), 0);

  const hourlyRevenue = filteredEntries
    .filter(e => {
      return isProjectBillableToClient(project) && e.billable && !isRetainer;
    })
    .reduce((sum, entry) => {
      return sum + ((entry.hours || 0) * projectRate);
    }, 0);

  const totalPayroll = filteredEntries.reduce((sum, entry) => {
    const teamMember = teamMembers.find(tm => tm.id === entry.team_member_id);
    const memberRate = teamMember?.hourly_rate || 0;
    return sum + ((entry.hours || 0) * memberRate);
  }, 0);

  const billedRevenue = filteredEntries
    .filter(e => {
      return isProjectBillableToClient(project) && e.client_billed && e.billable && !isRetainer;
    })
    .reduce((sum, entry) => {
      return sum + ((entry.hours || 0) * projectRate);
    }, 0);

  const unbilledRevenue = filteredEntries
    .filter(e => {
      return isProjectBillableToClient(project) && !e.client_billed && e.billable && !isRetainer;
    })
    .reduce((sum, entry) => {
      return sum + ((entry.hours || 0) * projectRate);
    }, 0);

  const paidPayroll = filteredEntries
    .filter(e => e.contractor_paid)
    .reduce((sum, entry) => {
      const teamMember = teamMembers.find(tm => tm.id === entry.team_member_id);
      const memberRate = teamMember?.hourly_rate || 0;
      return sum + ((entry.hours || 0) * memberRate);
    }, 0);

  const unpaidPayroll = filteredEntries
    .filter(e => !e.contractor_paid)
    .reduce((sum, entry) => {
      const teamMember = teamMembers.find(tm => tm.id === entry.team_member_id);
      const memberRate = teamMember?.hourly_rate || 0;
      return sum + ((entry.hours || 0) * memberRate);
    }, 0);

  const profit = hourlyRevenue - totalPayroll;
  const profitMargin = hourlyRevenue > 0 ? (profit / hourlyRevenue) * 100 : 0;

  const getTeamMemberName = (teamMemberId) => {
    const member = teamMembers.find(tm => tm.id === teamMemberId);
    return member?.full_name || "Unknown";
  };

  const resetFilters = () => {
    setBillingFilter("all");
    setPaymentFilter("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Client Billing</Label>
                <Select value={billingFilter} onValueChange={setBillingFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="billed">Billed</SelectItem>
                    <SelectItem value="unbilled">Unbilled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contractor Payment</Label>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {filteredEntries.length} of {timeEntries.length} time entries
              {(startDate || endDate) && (
                <span className="ml-2 text-indigo-600 font-medium">
                  {startDate && `from ${new Date(startDate + 'T00:00:00').toLocaleDateString()}`}
                  {startDate && endDate && ' '}
                  {endDate && `to ${new Date(endDate + 'T00:00:00').toLocaleDateString()}`}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{totalHours.toFixed(1)}h</div>
            <p className="text-xs text-gray-500 mt-1">{billableHours.toFixed(1)}h billable</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">${hourlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-gray-500 mt-1">From hourly billing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Payroll Costs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">${totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-gray-500 mt-1">Team labor costs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${profit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-gray-500 mt-1">{profitMargin.toFixed(1)}% margin</p>
          </CardContent>
        </Card>
      </div>

      {/* Billing & Payment Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Client Billing Status
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Hourly billing only - retainers are pre-paid</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Unbilled (Hourly)</div>
                <div className="text-2xl font-bold text-orange-600">
                  ${unbilledRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Billed (Hourly)</div>
                <div className="text-2xl font-bold text-green-600">
                  ${billedRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contractor Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Unpaid</div>
                <div className="text-2xl font-bold text-red-600">
                  ${unpaidPayroll.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Paid</div>
                <div className="text-2xl font-bold text-blue-600">
                  ${paidPayroll.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Time Entry Details</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No time entries match your filters</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Billed</TableHead>
                  <TableHead>Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map(entry => {
                  const teamMember = teamMembers.find(tm => tm.id === entry.team_member_id);
                  const memberRate = teamMember?.hourly_rate || 0;
                  const canBillToClient = isProjectBillableToClient(project) && !isRetainer;
                  const revenue = (entry.billable && canBillToClient) ? (entry.hours || 0) * projectRate : 0;
                  const cost = (entry.hours || 0) * memberRate;

                  return (
                    <TableRow key={entry.id} className="hover:bg-gray-50">
                      <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell>{getTeamMemberName(entry.team_member_id)}</TableCell>
                      <TableCell className="font-medium">{entry.hours}h</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {isRetainer ? (
                          <span className="text-xs text-gray-500">Retainer</span>
                        ) : revenue > 0 ? (
                          `$${revenue.toFixed(0)}`
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-red-600">
                        ${cost.toFixed(0)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {isRetainer ? (
                          <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700">
                            Pre-paid
                          </Badge>
                        ) : canBillToClient ? (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={entry.client_billed}
                              onCheckedChange={() => handleToggleBilled(entry.id, entry.client_billed)}
                              id={`billed-${entry.id}`}
                            />
                            <Label
                              htmlFor={`billed-${entry.id}`}
                              className={`cursor-pointer text-xs font-semibold px-2.5 py-0.5 rounded-full ${entry.client_billed ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
                            >
                              {entry.client_billed ? "✓ Billed" : "Unbilled"}
                            </Label>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={entry.contractor_paid}
                            onCheckedChange={() => handleTogglePaid(entry.id, entry.contractor_paid)}
                            id={`paid-${entry.id}`}
                          />
                          <Label
                            htmlFor={`paid-${entry.id}`}
                            className={`cursor-pointer text-xs font-semibold px-2.5 py-0.5 rounded-full ${entry.contractor_paid ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}
                          >
                            {entry.contractor_paid ? "✓ Paid" : "Unpaid"}
                          </Label>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}