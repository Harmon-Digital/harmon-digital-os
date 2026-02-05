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
import { Clock, TrendingUp, TrendingDown, DollarSign, ChevronLeft, ChevronRight, Trophy, Target, CheckCircle2, XCircle, List, CalendarDays } from "lucide-react";
import { KPI_DEFINITIONS, toWeekStart, formatWeekLabel, formatKpiValue, getKpiDef } from "@/config/kpiConfig";
import WeeklyCalendarView from "@/components/time/WeeklyCalendarView";

export default function Reports() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeEntries, setTimeEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // Top-level tab: "time" or "bonuses"
  const [tab, setTab] = useState("time");

  // Filters
  const [view, setView] = useState("unbilled"); // unbilled, unpaid, all
  const [timeViewMode, setTimeViewMode] = useState("list"); // list, calendar
  const [projectFilter, setProjectFilter] = useState("all");
  const [teamMemberFilter, setTeamMemberFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);

  // Bonus tab state
  const [bonusWeek, setBonusWeek] = useState(toWeekStart(new Date()));
  const [bonusEntries, setBonusEntries] = useState([]);
  const [bonusLoading, setBonusLoading] = useState(false);
  const [selectedBonusIds, setSelectedBonusIds] = useState([]);

  const isAdmin = userProfile?.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && tab === "bonuses") {
      loadBonusData();
    }
  }, [isAdmin, tab, bonusWeek]);

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

  const loadBonusData = async () => {
    setBonusLoading(true);
    try {
      const { data, error } = await supabase
        .from("kpi_entries")
        .select("*")
        .eq("month", bonusWeek)
        .not("team_member_id", "is", null)
        .gt("bonus_amount", 0);

      if (error) throw error;
      setBonusEntries(data || []);
    } catch (err) {
      console.error("Error loading bonus data:", err);
    } finally {
      setBonusLoading(false);
    }
  };

  const toggleBonusPaid = async (entry) => {
    const newStatus = !entry.bonus_paid;
    await supabase.from("kpi_entries").update({ bonus_paid: newStatus }).eq("id", entry.id);
    setBonusEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, bonus_paid: newStatus } : e));
  };

  const bulkMarkBonusPaid = async (status) => {
    await supabase.from("kpi_entries").update({ bonus_paid: status }).in("id", selectedBonusIds);
    setBonusEntries((prev) => prev.map((e) => selectedBonusIds.includes(e.id) ? { ...e, bonus_paid: status } : e));
    setSelectedBonusIds([]);
  };

  const shiftBonusWeek = (dir) => {
    const d = new Date(bonusWeek + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + dir * 7);
    setBonusWeek(toWeekStart(d));
  };

  // Group bonus entries by team member
  const bonusByMember = useMemo(() => {
    const map = {};
    bonusEntries.forEach((entry) => {
      if (!map[entry.team_member_id]) map[entry.team_member_id] = [];
      map[entry.team_member_id].push(entry);
    });
    return map;
  }, [bonusEntries]);

  // Bonus summary stats
  const bonusStats = useMemo(() => {
    let totalEarned = 0;
    let totalPotential = 0;
    let goalsHit = 0;
    let totalGoals = 0;
    let unpaidAmount = 0;

    bonusEntries.forEach((entry) => {
      const target = entry.target_value;
      const actual = entry.actual_value || 0;
      const bonus = entry.bonus_amount || 0;
      const pct = target ? (actual / target) * 100 : 0;
      totalPotential += bonus;
      totalGoals++;
      if (pct >= 100) {
        totalEarned += bonus;
        goalsHit++;
        if (!entry.bonus_paid) unpaidAmount += bonus;
      }
    });

    return { totalEarned, totalPotential, goalsHit, totalGoals, unpaidAmount };
  }, [bonusEntries]);

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

  // Flat list of earned (goal-met) bonus entries for the table
  const earnedBonusList = useMemo(() => {
    return bonusEntries
      .filter((e) => {
        const pct = e.target_value ? (e.actual_value / e.target_value) * 100 : 0;
        return pct >= 100;
      })
      .sort((a, b) => {
        const nameA = teamMembers.find((m) => m.id === a.team_member_id)?.full_name || "";
        const nameB = teamMembers.find((m) => m.id === b.team_member_id)?.full_name || "";
        return nameA.localeCompare(nameB);
      });
  }, [bonusEntries, teamMembers]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm">Financial overview & bonus payouts</p>
        </div>
      </div>

      {/* Top-level Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("time")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "time" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Clock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          Time & Billing
        </button>
        <button
          onClick={() => setTab("bonuses")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "bonuses" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Trophy className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          Bonuses
          {bonusStats.unpaidAmount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
              ${bonusStats.unpaidAmount.toLocaleString()}
            </span>
          )}
        </button>
      </div>

      {/* ====== TIME & BILLING TAB ====== */}
      {tab === "time" && (
        <>
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

            {/* List / Calendar toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setTimeViewMode("list")}
                className={`p-1.5 transition-colors ${timeViewMode === "list" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTimeViewMode("calendar")}
                className={`p-1.5 transition-colors ${timeViewMode === "calendar" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"}`}
              >
                <CalendarDays className="w-4 h-4" />
              </button>
            </div>
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

              {/* Time Entries — List or Calendar */}
              {timeViewMode === "list" ? (
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
              ) : (
                <WeeklyCalendarView
                  timeEntries={filteredEntries}
                  projects={projects}
                  users={teamMembers}
                />
              )}
            </>
          )}
        </>
      )}

      {/* ====== BONUSES TAB ====== */}
      {tab === "bonuses" && (
        <>
          {/* Week Navigation */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftBonusWeek(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[160px] text-center">
              {formatWeekLabel(bonusWeek)}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => shiftBonusWeek(1)}
              disabled={bonusWeek >= toWeekStart(new Date())}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            {bonusWeek !== toWeekStart(new Date()) && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setBonusWeek(toWeekStart(new Date()))}>
                This Week
              </Button>
            )}
          </div>

          {bonusLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 mb-1">Total Earned</p>
                    <p className="text-2xl font-bold text-green-600">${bonusStats.totalEarned.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 mb-1">Total Potential</p>
                    <p className="text-2xl font-bold text-gray-900">${bonusStats.totalPotential.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 mb-1">Goals Hit</p>
                    <p className="text-2xl font-bold text-gray-900">{bonusStats.goalsHit} / {bonusStats.totalGoals}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 mb-1">Unpaid Bonuses</p>
                    <p className={`text-2xl font-bold ${bonusStats.unpaidAmount > 0 ? "text-amber-600" : "text-gray-400"}`}>
                      ${bonusStats.unpaidAmount.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {bonusEntries.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No bonus goals set for this week.</p>
                    <p className="text-gray-400 text-xs mt-1">Set bonus amounts on the KPIs page when configuring targets.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Bulk Actions */}
                  {selectedBonusIds.length > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
                      <span className="text-sm font-medium">{selectedBonusIds.length} selected</span>
                      <div className="h-4 w-px bg-gray-300" />
                      <Button size="sm" onClick={() => bulkMarkBonusPaid(true)}>Mark Paid</Button>
                      <Button size="sm" variant="outline" onClick={() => bulkMarkBonusPaid(false)}>Mark Unpaid</Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedBonusIds([])}>Clear</Button>
                    </div>
                  )}

                  {/* Bonus Table */}
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedBonusIds.length === earnedBonusList.length && earnedBonusList.length > 0}
                              onCheckedChange={() => {
                                if (selectedBonusIds.length === earnedBonusList.length) {
                                  setSelectedBonusIds([]);
                                } else {
                                  setSelectedBonusIds(earnedBonusList.map((e) => e.id));
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead>Team Member</TableHead>
                          <TableHead>KPI</TableHead>
                          <TableHead className="text-right">Actual</TableHead>
                          <TableHead className="text-right">Target</TableHead>
                          <TableHead className="text-center">Progress</TableHead>
                          <TableHead className="text-right">Bonus</TableHead>
                          <TableHead className="text-center">Earned</TableHead>
                          <TableHead className="text-center">Paid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bonusEntries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                              No bonus goals for this week.
                            </TableCell>
                          </TableRow>
                        ) : (
                          bonusEntries
                            .sort((a, b) => {
                              const nameA = teamMembers.find((m) => m.id === a.team_member_id)?.full_name || "";
                              const nameB = teamMembers.find((m) => m.id === b.team_member_id)?.full_name || "";
                              return nameA.localeCompare(nameB) || a.slug.localeCompare(b.slug);
                            })
                            .map((entry) => {
                              const member = teamMembers.find((m) => m.id === entry.team_member_id);
                              const kpiDef = getKpiDef(entry.slug);
                              const actual = entry.actual_value || 0;
                              const target = entry.target_value || 0;
                              const pct = target ? Math.round((actual / target) * 100) : 0;
                              const earned = pct >= 100;

                              return (
                                <TableRow key={entry.id} className={selectedBonusIds.includes(entry.id) ? "bg-gray-50" : ""}>
                                  <TableCell>
                                    {earned && (
                                      <Checkbox
                                        checked={selectedBonusIds.includes(entry.id)}
                                        onCheckedChange={() => {
                                          setSelectedBonusIds((prev) =>
                                            prev.includes(entry.id) ? prev.filter((x) => x !== entry.id) : [...prev, entry.id]
                                          );
                                        }}
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="font-medium">{member?.full_name || "—"}</TableCell>
                                  <TableCell className="text-gray-600">{kpiDef?.name || entry.slug}</TableCell>
                                  <TableCell className="text-right font-medium tabular-nums">
                                    {kpiDef ? formatKpiValue(actual, kpiDef.unit) : actual}
                                  </TableCell>
                                  <TableCell className="text-right text-gray-500 tabular-nums">
                                    {kpiDef ? formatKpiValue(target, kpiDef.unit) : target}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2 justify-center">
                                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400"
                                          }`}
                                          style={{ width: `${Math.min(pct, 100)}%` }}
                                        />
                                      </div>
                                      <span className={`text-xs tabular-nums ${pct >= 100 ? "text-green-600 font-medium" : "text-gray-500"}`}>
                                        {pct}%
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-semibold tabular-nums">
                                    ${(entry.bonus_amount || 0).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {earned ? (
                                      <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {earned ? (
                                      <Checkbox
                                        checked={entry.bonus_paid}
                                        onCheckedChange={() => toggleBonusPaid(entry)}
                                      />
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                        )}
                      </TableBody>
                    </Table>
                  </Card>

                  {/* Per-member summary cards */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">By Team Member</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(bonusByMember).map(([memberId, entries]) => {
                        const member = teamMembers.find((m) => m.id === memberId);
                        let earned = 0;
                        let potential = 0;
                        let hits = 0;

                        entries.forEach((e) => {
                          const pct = e.target_value ? (e.actual_value / e.target_value) * 100 : 0;
                          potential += e.bonus_amount || 0;
                          if (pct >= 100) {
                            earned += e.bonus_amount || 0;
                            hits++;
                          }
                        });

                        return (
                          <Card key={memberId}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-medium text-sm">{member?.full_name || "Unknown"}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  hits === entries.length ? "bg-green-100 text-green-700" :
                                  hits > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                                }`}>
                                  {hits}/{entries.length} goals
                                </span>
                              </div>
                              {entries.map((e) => {
                                const kpiDef = getKpiDef(e.slug);
                                const pct = e.target_value ? Math.round((e.actual_value / e.target_value) * 100) : 0;
                                const hit = pct >= 100;
                                return (
                                  <div key={e.id} className="flex items-center justify-between text-xs py-1">
                                    <span className="text-gray-600">{kpiDef?.name || e.slug}</span>
                                    <div className="flex items-center gap-2">
                                      <span className={`tabular-nums ${hit ? "text-green-600 font-medium" : "text-gray-400"}`}>
                                        {pct}%
                                      </span>
                                      <span className={`font-medium tabular-nums ${hit ? "text-green-700" : "text-gray-400 line-through"}`}>
                                        ${(e.bonus_amount || 0).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                              <div className="mt-2 pt-2 border-t flex items-center justify-between">
                                <span className="text-xs text-gray-500">Total Earned</span>
                                <span className="text-sm font-bold text-green-600">${earned.toLocaleString()}</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
