import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { parseLocalDate } from "@/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, ChevronLeft, ChevronRight, Trophy, CheckCircle2, XCircle, List, CalendarDays } from "lucide-react";
import { toWeekStart, formatWeekLabel, formatKpiValue, getKpiDef } from "@/config/kpiConfig";
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
    const { error } = await supabase.from("kpi_entries").update({ bonus_paid: newStatus }).eq("id", entry.id);
    if (error) { console.error("Error toggling bonus paid:", error); return; }
    setBonusEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, bonus_paid: newStatus } : e));
  };

  const bulkMarkBonusPaid = async (status) => {
    const { error } = await supabase.from("kpi_entries").update({ bonus_paid: status }).in("id", selectedBonusIds);
    if (error) { console.error("Error bulk updating bonus paid:", error); return; }
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
    const { error } = await supabase.from("time_entries").update({ client_billed: newStatus }).eq("id", entry.id);
    if (error) { console.error("Error toggling billed:", error); return; }
    setTimeEntries(prev => prev.map(e => e.id === entry.id ? { ...e, client_billed: newStatus } : e));
  };

  const togglePaid = async (entry) => {
    const newStatus = !entry.contractor_paid;
    const { error } = await supabase.from("time_entries").update({ contractor_paid: newStatus }).eq("id", entry.id);
    if (error) { console.error("Error toggling paid:", error); return; }
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
    const { error } = await supabase.from("time_entries").update({ client_billed: status }).in("id", selectedIds);
    if (error) { console.error("Error bulk updating billed:", error); return; }
    setTimeEntries(prev => prev.map(e => selectedIds.includes(e.id) ? { ...e, client_billed: status } : e));
    setSelectedIds([]);
  };

  const bulkMarkPaid = async (status) => {
    const { error } = await supabase.from("time_entries").update({ contractor_paid: status }).in("id", selectedIds);
    if (error) { console.error("Error bulk updating paid:", error); return; }
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

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 mb-1">Admin access required</h2>
          <p className="text-[13px] text-gray-500">You need administrator privileges to view reports.</p>
        </div>
      </div>
    );
  }

  const unbilledCount = timeEntries.filter(e => e.billable && !e.client_billed).length;
  const unpaidCount = timeEntries.filter(e => !e.contractor_paid).length;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Top header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 px-4 h-12">
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Reports</h1>

          <div className="ml-3 flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5 text-[12px]">
            <button
              type="button"
              onClick={() => setTab("time")}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 ${
                tab === "time" ? "bg-gray-900 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Clock className="w-3 h-3" />
              Time & Billing
            </button>
            <button
              type="button"
              onClick={() => setTab("bonuses")}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 ${
                tab === "bonuses" ? "bg-gray-900 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Trophy className="w-3 h-3" />
              Bonuses
              {bonusStats.unpaidAmount > 0 && tab !== "bonuses" && (
                <span className="ml-0.5 text-amber-600 font-medium">
                  ${bonusStats.unpaidAmount.toLocaleString()}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ====== TIME & BILLING TAB ====== */}
      {tab === "time" && (
        <>
          {/* Sub-toolbar */}
          <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
            <div className="flex items-center gap-2 px-4 h-12">
              <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5 text-[12px]">
                <button
                  type="button"
                  onClick={() => setView("unbilled")}
                  className={`px-2.5 py-1 rounded ${
                    view === "unbilled" ? "bg-gray-900 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  Unbilled <span className="opacity-60">({unbilledCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView("unpaid")}
                  className={`px-2.5 py-1 rounded ${
                    view === "unpaid" ? "bg-gray-900 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  Unpaid <span className="opacity-60">({unpaidCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView("all")}
                  className={`px-2.5 py-1 rounded ${
                    view === "all" ? "bg-gray-900 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  All
                </button>
              </div>

              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-36 h-8 text-[13px] border-gray-200 dark:border-gray-800">
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
                <SelectTrigger className="w-36 h-8 text-[13px] border-gray-200 dark:border-gray-800">
                  <SelectValue placeholder="All Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team</SelectItem>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="ml-auto flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setTimeViewMode("list")}
                  className={`p-1 rounded ${timeViewMode === "list" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                  title="List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setTimeViewMode("calendar")}
                  className={`p-1 rounded ${timeViewMode === "calendar" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                  title="Calendar"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-gray-200 dark:border-gray-800 border-t-gray-400 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {/* Metric pill strip */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
                  {view === "unbilled" && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      Unbilled <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">${unbilledRevenue.toLocaleString()}</span>
                    </span>
                  )}
                  {view === "unpaid" && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Unpaid <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">${unpaidPayroll.toLocaleString()}</span>
                    </span>
                  )}
                  <span>
                    Entries <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{filteredEntries.length}</span>
                  </span>
                  <span>
                    Hours <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{totalHours.toFixed(1)}</span>
                  </span>
                </div>

                {/* Bulk Actions */}
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2 px-3 h-9 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md">
                    <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{selectedIds.length} selected</span>
                    <div className="h-4 w-px bg-gray-300" />
                    {view === "unpaid" ? (
                      <>
                        <Button size="sm" className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]" onClick={() => bulkMarkPaid(true)}>Mark Paid</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[13px]" onClick={() => bulkMarkPaid(false)}>Mark Unpaid</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]" onClick={() => bulkMarkBilled(true)}>Mark Billed</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[13px]" onClick={() => bulkMarkBilled(false)}>Mark Unbilled</Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[13px]" onClick={() => setSelectedIds([])}>Clear</Button>
                  </div>
                )}

                {/* Time Entries — List or Calendar */}
                {timeViewMode === "list" ? (
                  <div>
                    {/* Header row */}
                    <div className="flex items-center gap-3 px-2 h-7 border-b border-gray-200 dark:border-gray-800 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      <div className="w-5 flex-shrink-0">
                        <Checkbox
                          checked={selectedIds.length === filteredEntries.length && filteredEntries.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </div>
                      <div className="w-24">Date</div>
                      <div className="flex-1">Project</div>
                      <div className="flex-1">Team Member</div>
                      <div className="w-16 text-right">Hours</div>
                      <div className="w-24 text-right">{view === "unpaid" ? "Cost" : "Amount"}</div>
                      <div className="w-16 text-center">{view === "unpaid" ? "Paid" : "Billed"}</div>
                    </div>

                    {filteredEntries.length === 0 ? (
                      <div className="py-16 text-center text-[13px] text-gray-500">
                        {view === "unbilled" ? "All caught up. No unbilled entries." :
                         view === "unpaid" ? "All caught up. No unpaid entries." :
                         "No time entries found."}
                      </div>
                    ) : (
                      filteredEntries.map(entry => {
                        const project = projects.find(p => p.id === entry.project_id);
                        const member = teamMembers.find(m => m.id === entry.team_member_id);
                        const amount = (entry.hours || 0) * (project?.hourly_rate || 0);
                        const cost = (entry.hours || 0) * (member?.hourly_rate || 0);

                        return (
                          <div
                            key={entry.id}
                            className={`flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
                              selectedIds.includes(entry.id) ? "bg-gray-50 dark:bg-gray-900" : ""
                            }`}
                          >
                            <div className="w-5 flex-shrink-0">
                              <Checkbox
                                checked={selectedIds.includes(entry.id)}
                                onCheckedChange={() => toggleSelect(entry.id)}
                              />
                            </div>
                            <div className="w-24 text-[12px] text-gray-500 tabular-nums">
                              {parseLocalDate(entry.date).toLocaleDateString()}
                            </div>
                            <div className="flex-1 min-w-0 truncate text-[13px] text-gray-900 dark:text-gray-100">
                              {project?.name || "—"}
                            </div>
                            <div className="flex-1 min-w-0 truncate text-[13px] text-gray-600 dark:text-gray-400">
                              {member?.full_name || "—"}
                            </div>
                            <div className="w-16 text-right text-[13px] text-gray-900 dark:text-gray-100 tabular-nums">
                              {entry.hours}h
                            </div>
                            <div className="w-24 text-right text-[13px] text-gray-900 dark:text-gray-100 font-medium tabular-nums">
                              {view === "unpaid" ? `$${cost.toLocaleString()}` : `$${amount.toLocaleString()}`}
                            </div>
                            <div className="w-16 flex justify-center">
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
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <WeeklyCalendarView
                    timeEntries={filteredEntries}
                    projects={projects}
                    users={teamMembers}
                  />
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ====== BONUSES TAB ====== */}
      {tab === "bonuses" && (
        <>
          {/* Week Navigation Toolbar */}
          <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
            <div className="flex items-center gap-2 px-4 h-12">
              <div className="flex items-center gap-0.5 border border-gray-200 dark:border-gray-800 rounded-md h-8 text-[12px]">
                <button
                  type="button"
                  onClick={() => shiftBonusWeek(-1)}
                  className="h-full px-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-200"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-gray-700 dark:text-gray-300 min-w-[140px] text-center tabular-nums">
                  {formatWeekLabel(bonusWeek)}
                </span>
                <button
                  type="button"
                  onClick={() => shiftBonusWeek(1)}
                  disabled={bonusWeek >= toWeekStart(new Date())}
                  className="h-full px-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-200 disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {bonusWeek !== toWeekStart(new Date()) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[13px]"
                  onClick={() => setBonusWeek(toWeekStart(new Date()))}
                >
                  This Week
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {bonusLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-gray-200 dark:border-gray-800 border-t-gray-400 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Metric pill strip */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Earned <span className="text-emerald-600 font-medium tabular-nums">${bonusStats.totalEarned.toLocaleString()}</span>
                  </span>
                  <span>
                    Potential <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">${bonusStats.totalPotential.toLocaleString()}</span>
                  </span>
                  <span>
                    Goals hit <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{bonusStats.goalsHit} / {bonusStats.totalGoals}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${bonusStats.unpaidAmount > 0 ? "bg-amber-500" : "bg-gray-300"}`} />
                    Unpaid <span className={`font-medium tabular-nums ${bonusStats.unpaidAmount > 0 ? "text-amber-600" : "text-gray-400 dark:text-gray-500"}`}>
                      ${bonusStats.unpaidAmount.toLocaleString()}
                    </span>
                  </span>
                </div>

                {bonusEntries.length === 0 ? (
                  <div className="py-16 text-center">
                    <Trophy className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-[13px] text-gray-500">No bonus goals set for this week.</p>
                    <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">Set bonus amounts on the KPIs page when configuring targets.</p>
                  </div>
                ) : (
                  <>
                    {/* Bulk Actions */}
                    {selectedBonusIds.length > 0 && (
                      <div className="flex items-center gap-2 px-3 h-9 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md">
                        <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{selectedBonusIds.length} selected</span>
                        <div className="h-4 w-px bg-gray-300" />
                        <Button size="sm" className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]" onClick={() => bulkMarkBonusPaid(true)}>Mark Paid</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[13px]" onClick={() => bulkMarkBonusPaid(false)}>Mark Unpaid</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[13px]" onClick={() => setSelectedBonusIds([])}>Clear</Button>
                      </div>
                    )}

                    {/* Bonus List */}
                    <div>
                      <div className="flex items-center gap-3 px-2 h-7 border-b border-gray-200 dark:border-gray-800 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        <div className="w-5 flex-shrink-0">
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
                        </div>
                        <div className="flex-1">Team Member</div>
                        <div className="flex-1">KPI</div>
                        <div className="w-20 text-right">Actual</div>
                        <div className="w-20 text-right">Target</div>
                        <div className="w-32 text-center">Progress</div>
                        <div className="w-20 text-right">Bonus</div>
                        <div className="w-16 text-center">Earned</div>
                        <div className="w-14 text-center">Paid</div>
                      </div>

                      {bonusEntries.length === 0 ? (
                        <div className="py-10 text-center text-[13px] text-gray-500">No bonus goals for this week.</div>
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
                              <div
                                key={entry.id}
                                className={`flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
                                  selectedBonusIds.includes(entry.id) ? "bg-gray-50 dark:bg-gray-900" : ""
                                }`}
                              >
                                <div className="w-5 flex-shrink-0">
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
                                </div>
                                <div className="flex-1 min-w-0 truncate text-[13px] text-gray-900 dark:text-gray-100 font-medium">
                                  {member?.full_name || "—"}
                                </div>
                                <div className="flex-1 min-w-0 truncate text-[13px] text-gray-600 dark:text-gray-400">
                                  {kpiDef?.name || entry.slug}
                                </div>
                                <div className="w-20 text-right text-[13px] text-gray-900 dark:text-gray-100 font-medium tabular-nums">
                                  {kpiDef ? formatKpiValue(actual, kpiDef.unit) : actual}
                                </div>
                                <div className="w-20 text-right text-[13px] text-gray-500 tabular-nums">
                                  {kpiDef ? formatKpiValue(target, kpiDef.unit) : target}
                                </div>
                                <div className="w-32 flex items-center gap-2 justify-center">
                                  <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400"
                                      }`}
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`text-[12px] tabular-nums ${pct >= 100 ? "text-emerald-600 font-medium" : "text-gray-500"}`}>
                                    {pct}%
                                  </span>
                                </div>
                                <div className="w-20 text-right text-[13px] text-gray-900 dark:text-gray-100 font-semibold tabular-nums">
                                  ${(entry.bonus_amount || 0).toLocaleString()}
                                </div>
                                <div className="w-16 flex justify-center">
                                  {earned ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                                  )}
                                </div>
                                <div className="w-14 flex justify-center">
                                  {earned ? (
                                    <Checkbox
                                      checked={entry.bonus_paid}
                                      onCheckedChange={() => toggleBonusPaid(entry)}
                                    />
                                  ) : (
                                    <span className="text-gray-300 dark:text-gray-600 text-[13px]">—</span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>

                    {/* Per-member summary */}
                    <div className="pt-2">
                      <div className="h-7 flex items-center text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        By team member
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                            <div key={memberId} className="border border-gray-200 dark:border-gray-800 rounded-md p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
                                  {member?.full_name || "Unknown"}
                                </span>
                                <span className={`text-[11px] tabular-nums ${
                                  hits === entries.length ? "text-emerald-600" :
                                  hits > 0 ? "text-amber-600" : "text-gray-500"
                                }`}>
                                  {hits}/{entries.length} goals
                                </span>
                              </div>
                              <div className="space-y-1">
                                {entries.map((e) => {
                                  const kpiDef = getKpiDef(e.slug);
                                  const pct = e.target_value ? Math.round((e.actual_value / e.target_value) * 100) : 0;
                                  const hit = pct >= 100;
                                  return (
                                    <div key={e.id} className="flex items-center justify-between text-[12px]">
                                      <span className="text-gray-600 dark:text-gray-400 truncate">{kpiDef?.name || e.slug}</span>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className={`tabular-nums ${hit ? "text-emerald-600 font-medium" : "text-gray-400 dark:text-gray-500"}`}>
                                          {pct}%
                                        </span>
                                        <span className={`font-medium tabular-nums ${hit ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500 line-through"}`}>
                                          ${(e.bonus_amount || 0).toLocaleString()}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                <span className="text-[11px] uppercase tracking-wide text-gray-500">Earned</span>
                                <span className="text-[13px] font-semibold text-emerald-600 tabular-nums">${earned.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
