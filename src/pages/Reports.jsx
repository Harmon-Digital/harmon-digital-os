import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

export default function Reports() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeEntries, setTimeEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // Filters
  const [view, setView] = useState("unbilled"); // unbilled, unpaid, all
  const [projectFilter, setProjectFilter] = useState("all");
  const [teamMemberFilter, setTeamMemberFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);

  const isAdmin = userProfile?.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsRes, teamRes, timeRes] = await Promise.all([
        supabase.from("projects").select("id, name, hourly_rate, billing_type, monthly_retainer"),
        supabase.from("team_members").select("id, full_name, hourly_rate"),
        supabase.from("time_entries")
          .select("*")
          .order("date", { ascending: false })
      ]);

      setProjects(projectsRes.data || []);
      setTeamMembers(teamRes.data || []);
      setTimeEntries(timeRes.data || []);
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBilled = async (entry) => {
    const newStatus = !entry.client_billed;
    await supabase.from("time_entries").update({ client_billed: newStatus }).eq("id", entry.id);
    setTimeEntries(prev => prev.map(e => e.id === entry.id ? { ...e, client_billed: newStatus } : e));
  };

  const togglePaid = async (entry) => {
    const newStatus = !entry.contractor_paid;
    await supabase.from("time_entries").update({ contractor_paid: newStatus }).eq("id", entry.id);
    setTimeEntries(prev => prev.map(e => e.id === entry.id ? { ...e, contractor_paid: newStatus } : e));
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEntries.map(e => e.id));
    }
  };

  const bulkMarkBilled = async (status) => {
    await supabase.from("time_entries").update({ client_billed: status }).in("id", selectedIds);
    setTimeEntries(prev => prev.map(e => selectedIds.includes(e.id) ? { ...e, client_billed: status } : e));
    setSelectedIds([]);
  };

  const bulkMarkPaid = async (status) => {
    await supabase.from("time_entries").update({ contractor_paid: status }).in("id", selectedIds);
    setTimeEntries(prev => prev.map(e => selectedIds.includes(e.id) ? { ...e, contractor_paid: status } : e));
    setSelectedIds([]);
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    return timeEntries.filter(e => {
      // View filter
      if (view === "unbilled" && (e.client_billed || !e.billable)) return false;
      if (view === "unpaid" && e.contractor_paid) return false;
      // Other filters
      if (projectFilter !== "all" && e.project_id !== projectFilter) return false;
      if (teamMemberFilter !== "all" && e.team_member_id !== teamMemberFilter) return false;
      return true;
    });
  }, [timeEntries, view, projectFilter, teamMemberFilter]);

  // Calculate metrics from filtered entries
  const totalHours = filteredEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const billableHours = filteredEntries.filter(e => e.billable).reduce((sum, e) => sum + (e.hours || 0), 0);

  const revenue = filteredEntries
    .filter(e => e.billable)
    .reduce((sum, e) => {
      const project = projects.find(p => p.id === e.project_id);
      return sum + ((e.hours || 0) * (project?.hourly_rate || 0));
    }, 0);

  const laborCost = filteredEntries.reduce((sum, e) => {
    const member = teamMembers.find(m => m.id === e.team_member_id);
    return sum + ((e.hours || 0) * (member?.hourly_rate || 0));
  }, 0);

  const profit = revenue - laborCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Unbilled & Unpaid
  const unbilledRevenue = filteredEntries
    .filter(e => e.billable && !e.client_billed)
    .reduce((sum, e) => {
      const project = projects.find(p => p.id === e.project_id);
      return sum + ((e.hours || 0) * (project?.hourly_rate || 0));
    }, 0);

  const unpaidPayroll = filteredEntries
    .filter(e => !e.contractor_paid)
    .reduce((sum, e) => {
      const member = teamMembers.find(m => m.id === e.team_member_id);
      return sum + ((e.hours || 0) * (member?.hourly_rate || 0));
    }, 0);

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-500">You need administrator privileges to view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm">Financial overview</p>
        </div>

      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 border-b">
        <button
          onClick={() => setView("unbilled")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            view === "unbilled" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500"
          }`}
        >
          Unbilled ({timeEntries.filter(e => e.billable && !e.client_billed).length})
        </button>
        <button
          onClick={() => setView("unpaid")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            view === "unpaid" ? "border-red-500 text-red-600" : "border-transparent text-gray-500"
          }`}
        >
          Unpaid ({timeEntries.filter(e => !e.contractor_paid).length})
        </button>
        <button
          onClick={() => setView("all")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            view === "all" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500"
          }`}
        >
          All
        </button>

        <div className="flex-1" />

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={teamMemberFilter} onValueChange={setTeamMemberFilter}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="All Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Team</SelectItem>
            {teamMembers.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary for current view */}
          <div className="flex items-center gap-6 text-sm">
            {view === "unbilled" && (
              <span className="font-semibold text-orange-600">
                ${unbilledRevenue.toLocaleString()} unbilled
              </span>
            )}
            {view === "unpaid" && (
              <span className="font-semibold text-red-600">
                ${unpaidPayroll.toLocaleString()} unpaid
              </span>
            )}
            <span className="text-gray-500">
              {filteredEntries.length} entries • {totalHours.toFixed(1)}h
            </span>
          </div>

          {/* Bulk Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
              <span className="text-sm font-medium">{selectedIds.length} selected</span>
              <div className="h-4 w-px bg-gray-300" />
              {view === "unpaid" ? (
                <>
                  <Button size="sm" onClick={() => bulkMarkPaid(true)}>Mark Paid</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkMarkPaid(false)}>Mark Unpaid</Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={() => bulkMarkBilled(true)}>Mark Billed</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkMarkBilled(false)}>Mark Unbilled</Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Clear</Button>
            </div>
          )}

          {/* Time Entries Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.length === filteredEntries.length && filteredEntries.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>{view === "unpaid" ? "Cost" : "Amount"}</TableHead>
                  <TableHead>{view === "unpaid" ? "Paid" : "Billed"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {view === "unbilled" ? "All caught up! No unbilled entries." :
                       view === "unpaid" ? "All caught up! No unpaid entries." :
                       "No time entries found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map(entry => {
                    const project = projects.find(p => p.id === entry.project_id);
                    const member = teamMembers.find(m => m.id === entry.team_member_id);
                    const amount = (entry.hours || 0) * (project?.hourly_rate || 0);
                    const cost = (entry.hours || 0) * (member?.hourly_rate || 0);

                    return (
                      <TableRow key={entry.id} className={selectedIds.includes(entry.id) ? "bg-gray-50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(entry.id)}
                            onCheckedChange={() => toggleSelect(entry.id)}
                          />
                        </TableCell>
                        <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                        <TableCell>{project?.name || "—"}</TableCell>
                        <TableCell>{member?.full_name || "—"}</TableCell>
                        <TableCell>{entry.hours}h</TableCell>
                        <TableCell>
                          {view === "unpaid" ? `$${cost.toLocaleString()}` : `$${amount.toLocaleString()}`}
                        </TableCell>
                        <TableCell>
                          {view === "unpaid" ? (
                            <Checkbox
                              checked={entry.contractor_paid}
                              onCheckedChange={() => togglePaid(entry)}
                            />
                          ) : (
                            <Checkbox
                              checked={entry.client_billed}
                              onCheckedChange={() => toggleBilled(entry)}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
