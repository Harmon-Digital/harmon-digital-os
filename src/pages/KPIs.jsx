import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Target,
  Pencil,
  Loader2,
  ArrowUp,
  ArrowDown,
  Minus,
  Zap,
  Trophy,
  TrendingUp,
  CheckCircle2,
  Check,
} from "lucide-react";
import {
  KPI_DEFINITIONS,
  formatKpiValue,
  toWeekStart,
  formatWeekLabel,
} from "@/config/kpiConfig";
import { calculateAllAutoKpis, saveEntries, fetchEntriesForRange } from "@/api/kpiCalculations";
import { TeamMember } from "@/api/supabaseEntities";
import KpiTrendChart from "@/components/kpis/KpiTrendChart";
import KpiTargetSheet from "@/components/kpis/KpiTargetSheet";
import KpiEntryDialog from "@/components/kpis/KpiEntryDialog";

const CATEGORY_LABELS = {
  revenue: "Revenue",
  leads: "Leads",
  social: "Social Media",
  operations: "Operations",
};

export default function KPIs() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === "admin";

  const [selectedWeek, setSelectedWeek] = useState(() => toWeekStart(new Date()));

  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTargetSheet, setShowTargetSheet] = useState(false);
  const [editingKpi, setEditingKpi] = useState(null);
  const [expandedKpi, setExpandedKpi] = useState(null);
  // Inline editing
  const [inlineEditSlug, setInlineEditSlug] = useState(null);
  const [inlineTarget, setInlineTarget] = useState("");
  const [inlineBonus, setInlineBonus] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState(null);

  const currentEntries = allEntries.filter((e) => e.month === selectedWeek);
  const previousWeek = getPreviousWeek(selectedWeek);
  const previousEntries = allEntries.filter((e) => e.month === previousWeek);

  // Filter KPI definitions based on selected team member
  const visibleKpis = selectedTeamMember
    ? KPI_DEFINITIONS.filter((k) => k.perMember)
    : KPI_DEFINITIONS;

  function getPreviousWeek(weekStr) {
    const d = new Date(weekStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().split("T")[0];
  }

  function getWeekRange(weekStr, count) {
    const weeks = [];
    let current = weekStr;
    for (let i = 0; i < count; i++) {
      weeks.unshift(current);
      current = getPreviousWeek(current);
    }
    return weeks;
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const weeks = getWeekRange(selectedWeek, 8);
      const startWeek = weeks[0];
      const endWeek = weeks[weeks.length - 1];

      const [entries, members] = await Promise.all([
        fetchEntriesForRange(startWeek, endWeek, selectedTeamMember),
        teamMembers.length === 0 ? TeamMember.list() : Promise.resolve(teamMembers),
      ]);

      setAllEntries(entries);
      if (teamMembers.length === 0) {
        setTeamMembers(members.filter((m) => m.status === "active"));
      }
    } catch (err) {
      console.error("Error loading KPI data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedWeek, selectedTeamMember]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const autoValues = await calculateAllAutoKpis(selectedWeek, selectedTeamMember);
      const entriesToSave = Object.entries(autoValues)
        .filter(([, val]) => val !== null)
        .map(([slug, value]) => {
          const existing = currentEntries.find((e) => e.slug === slug);
          return {
            slug,
            month: selectedWeek,
            actual_value: value,
            team_member_id: selectedTeamMember || null,
            ...(existing?.target_value !== undefined && { target_value: existing.target_value }),
          };
        });
      if (entriesToSave.length > 0) {
        await saveEntries(entriesToSave);
      }
      await loadData();
    } catch (err) {
      console.error("Error refreshing KPIs:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveTargets = async (targetEntries) => {
    const entriesToSave = targetEntries.map((t) => {
      const existing = currentEntries.find((e) => e.slug === t.slug);
      return {
        slug: t.slug,
        month: t.month,
        target_value: t.target_value,
        bonus_amount: t.bonus_amount !== undefined ? t.bonus_amount : undefined,
        actual_value: existing?.actual_value || 0,
        team_member_id: t.team_member_id || null,
      };
    });
    await saveEntries(entriesToSave);
    await loadData();
  };

  const handleSaveManualEntry = async (entry) => {
    const existing = currentEntries.find((e) => e.slug === entry.slug);
    await saveEntries([{
      slug: entry.slug,
      month: entry.month,
      actual_value: entry.actual_value,
      notes: entry.notes,
      team_member_id: entry.team_member_id || null,
      ...(existing?.target_value !== undefined && { target_value: existing.target_value }),
    }]);
    await loadData();
  };

  const startInlineEdit = (kpi) => {
    const entry = currentEntries.find((e) => e.slug === kpi.slug);
    setInlineEditSlug(kpi.slug);
    setInlineTarget(entry?.target_value ?? "");
    setInlineBonus(entry?.bonus_amount ?? "");
  };

  const saveInlineEdit = async () => {
    if (!inlineEditSlug) return;
    setInlineSaving(true);
    try {
      const existing = currentEntries.find((e) => e.slug === inlineEditSlug);
      const targetVal = inlineTarget === "" ? null : Number(inlineTarget);
      const bonusVal = inlineBonus === "" ? null : Number(inlineBonus);

      await saveEntries([{
        slug: inlineEditSlug,
        month: selectedWeek,
        actual_value: existing?.actual_value || 0,
        target_value: targetVal,
        bonus_amount: bonusVal,
        team_member_id: selectedTeamMember || null,
      }]);
      await loadData();
    } catch (err) {
      console.error("Error saving inline edit:", err);
    } finally {
      setInlineSaving(false);
      setInlineEditSlug(null);
    }
  };

  const cancelInlineEdit = () => {
    setInlineEditSlug(null);
  };

  const navigateWeek = (direction) => {
    const d = new Date(selectedWeek + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + direction * 7);
    setSelectedWeek(d.toISOString().split("T")[0]);
  };

  const currentWeekStr = toWeekStart(new Date());
  const canGoForward = selectedWeek < currentWeekStr;

  const getEntryValue = (slug, field) => {
    const entry = currentEntries.find((e) => e.slug === slug);
    return entry ? entry[field] : null;
  };

  const getPreviousValue = (slug) => {
    const entry = previousEntries.find((e) => e.slug === slug);
    return entry ? Number(entry.actual_value) || 0 : null;
  };

  const selectedMemberName = selectedTeamMember
    ? teamMembers.find((m) => m.id === selectedTeamMember)?.full_name
    : null;

  // Summary stats for top cards
  const summaryStats = useMemo(() => {
    let withTargets = 0;
    let goalsHit = 0;
    let totalBonusEarned = 0;
    let totalBonusPotential = 0;

    visibleKpis.forEach((kpi) => {
      const entry = currentEntries.find((e) => e.slug === kpi.slug);
      if (!entry) return;
      const target = entry.target_value;
      const actual = entry.actual_value || 0;
      const bonus = entry.bonus_amount || 0;

      if (target) {
        withTargets++;
        if (actual >= target) goalsHit++;
      }
      if (bonus > 0) {
        totalBonusPotential += bonus;
        if (target && actual >= target) totalBonusEarned += bonus;
      }
    });

    return { withTargets, goalsHit, totalBonusEarned, totalBonusPotential };
  }, [visibleKpis, currentEntries]);

  if (!isAdmin) {
    return (
      <div className="p-6 lg:p-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Admin Access Required</h2>
          <p className="text-gray-500 mt-2">KPI tracking is only available to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPIs</h1>
          <p className="text-gray-500 text-sm">
            {selectedMemberName || "Weekly business metrics"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={selectedTeamMember || "company"}
            onValueChange={(v) => setSelectedTeamMember(v === "company" ? null : v)}
          >
            <SelectTrigger className="w-[170px] h-8 text-sm">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="company">Company (All)</SelectItem>
              {teamMembers.map((tm) => (
                <SelectItem key={tm.id} value={tm.id}>{tm.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[160px] text-center">
              {formatWeekLabel(selectedWeek)}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(1)} disabled={!canGoForward}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            {selectedWeek !== currentWeekStr && (
              <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setSelectedWeek(currentWeekStr)}>
                This Week
              </Button>
            )}
          </div>

          <Button variant="outline" size="sm" className="h-8" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Refresh
          </Button>
          <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowTargetSheet(true)}>
            <Target className="w-3.5 h-3.5 mr-1.5" />
            Set Targets
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 mb-1">Goals Tracked</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.withTargets}</p>
                <p className="text-xs text-gray-400 mt-0.5">{visibleKpis.length} total KPIs</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 mb-1">Goals Hit</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summaryStats.goalsHit}
                  <span className="text-base font-normal text-gray-400"> / {summaryStats.withTargets}</span>
                </p>
                {summaryStats.withTargets > 0 && (
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full ${
                        summaryStats.goalsHit === summaryStats.withTargets ? "bg-green-500" :
                        summaryStats.goalsHit > 0 ? "bg-amber-500" : "bg-red-400"
                      }`}
                      style={{ width: `${summaryStats.withTargets > 0 ? (summaryStats.goalsHit / summaryStats.withTargets) * 100 : 0}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 mb-1">Bonus Earned</p>
                <p className={`text-2xl font-bold ${summaryStats.totalBonusEarned > 0 ? "text-green-600" : "text-gray-400"}`}>
                  ${summaryStats.totalBonusEarned.toLocaleString()}
                </p>
                {summaryStats.totalBonusPotential > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">${summaryStats.totalBonusPotential.toLocaleString()} potential</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 mb-1">Overall Progress</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summaryStats.withTargets > 0
                    ? `${Math.round((summaryStats.goalsHit / summaryStats.withTargets) * 100)}%`
                    : "--"
                  }
                </p>
                <p className="text-xs text-gray-400 mt-0.5">goal completion rate</p>
              </CardContent>
            </Card>
          </div>

          {/* KPI Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-center">Progress</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-center">vs Last Week</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const categories = [...new Set(visibleKpis.map((k) => k.category))];
                  const rows = [];

                  categories.forEach((category) => {
                    const catKpis = visibleKpis.filter((k) => k.category === category);

                    // Category header row
                    rows.push(
                      <TableRow key={`cat-${category}`} className="bg-gray-50/80 hover:bg-gray-50/80">
                        <TableCell colSpan={7} className="py-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {CATEGORY_LABELS[category] || category}
                          </span>
                        </TableCell>
                      </TableRow>
                    );

                    catKpis.forEach((kpi) => {
                      const Icon = kpi.icon;
                      const actual = Number(getEntryValue(kpi.slug, "actual_value")) || 0;
                      const target = getEntryValue(kpi.slug, "target_value");
                      const targetNum = target !== null && target !== undefined ? Number(target) : null;
                      const pct = targetNum ? Math.round((actual / targetNum) * 100) : null;
                      const prevActual = getPreviousValue(kpi.slug);
                      const bonusAmt = Number(getEntryValue(kpi.slug, "bonus_amount")) || 0;
                      let delta = null;
                      if (prevActual !== null && prevActual !== 0) {
                        delta = ((actual - prevActual) / prevActual) * 100;
                      } else if (prevActual === 0 && actual > 0) {
                        delta = 100;
                      }
                      const isExpanded = expandedKpi === kpi.slug;

                      rows.push(
                        <React.Fragment key={kpi.slug}>
                          <TableRow
                            className={`cursor-pointer transition-colors ${isExpanded ? "bg-gray-50" : "hover:bg-gray-50/50"}`}
                            onClick={() => setExpandedKpi(isExpanded ? null : kpi.slug)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                                <span className="text-sm font-medium text-gray-900">{kpi.name}</span>
                                {kpi.calcType === "auto" && <Zap className="w-3 h-3 text-amber-400 shrink-0" />}
                                {kpi.calcType === "manual" && (
                                  <button
                                    className="p-0.5 rounded hover:bg-gray-200 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); setEditingKpi(kpi); }}
                                  >
                                    <Pencil className="w-3 h-3 text-gray-400" />
                                  </button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formatKpiValue(actual, kpi.unit)}
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              {inlineEditSlug === kpi.slug ? (
                                <Input
                                  type="number"
                                  className="w-24 h-7 text-sm text-right ml-auto tabular-nums"
                                  value={inlineTarget}
                                  onChange={(e) => setInlineTarget(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveInlineEdit();
                                    if (e.key === "Escape") cancelInlineEdit();
                                  }}
                                  autoFocus
                                  placeholder="Target"
                                />
                              ) : (
                                <span
                                  className="text-gray-500 tabular-nums cursor-pointer hover:text-indigo-600 hover:underline decoration-dashed underline-offset-2 transition-colors"
                                  onClick={() => startInlineEdit(kpi)}
                                >
                                  {targetNum !== null ? formatKpiValue(targetNum, kpi.unit) : <span className="text-gray-300 italic">set</span>}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {pct !== null ? (
                                <div className="flex items-center gap-2 justify-center">
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400"
                                      }`}
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-medium tabular-nums ${
                                    pct >= 100 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-500"
                                  }`}>
                                    {pct}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300 text-center block">--</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums" onClick={(e) => e.stopPropagation()}>
                              {inlineEditSlug === kpi.slug ? (
                                <div className="flex items-center gap-1 justify-end">
                                  <Input
                                    type="number"
                                    className="w-20 h-7 text-sm text-right tabular-nums"
                                    value={inlineBonus}
                                    onChange={(e) => setInlineBonus(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveInlineEdit();
                                      if (e.key === "Escape") cancelInlineEdit();
                                    }}
                                    placeholder="$0"
                                  />
                                  <button
                                    onClick={saveInlineEdit}
                                    disabled={inlineSaving}
                                    className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                                  >
                                    {inlineSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className="cursor-pointer hover:text-indigo-600 transition-colors"
                                  onClick={() => startInlineEdit(kpi)}
                                >
                                  {bonusAmt > 0 ? (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                      pct >= 100 ? "bg-green-100 text-green-700 font-medium" : "bg-gray-100 text-gray-500"
                                    }`}>
                                      ${bonusAmt.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 italic text-xs">set</span>
                                  )}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {delta !== null ? (
                                <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                                  {delta >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                  {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%
                                </span>
                              ) : (
                                <Minus className="w-3 h-3 text-gray-300 mx-auto" />
                              )}
                            </TableCell>
                            <TableCell>
                              {pct >= 100 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </TableCell>
                          </TableRow>

                          {/* Expanded trend chart */}
                          {isExpanded && (
                            <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                              <TableCell colSpan={7} className="py-2 px-4">
                                <KpiTrendChart
                                  kpiDef={kpi}
                                  data={getWeekRange(selectedWeek, 8).map((w) => {
                                    const entry = allEntries.find((e) => e.slug === kpi.slug && e.month === w);
                                    return {
                                      month: w,
                                      actual_value: entry?.actual_value || 0,
                                      target_value: entry?.target_value ?? null,
                                    };
                                  })}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    });
                  });

                  return rows;
                })()}

                {visibleKpis.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No KPIs to display.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Empty state */}
          {!selectedTeamMember && currentEntries.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">No data for {formatWeekLabel(selectedWeek)}</p>
                <p className="text-gray-400 text-xs mt-1">Click "Refresh" to pull metrics from your data.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <KpiTargetSheet
        open={showTargetSheet}
        onClose={() => setShowTargetSheet(false)}
        selectedWeek={selectedWeek}
        currentEntries={currentEntries}
        previousEntries={previousEntries}
        onSave={handleSaveTargets}
        selectedTeamMember={selectedTeamMember}
        selectedMemberName={selectedMemberName}
      />

      <KpiEntryDialog
        open={!!editingKpi}
        onClose={() => setEditingKpi(null)}
        kpiDef={editingKpi}
        snapshot={editingKpi ? currentEntries.find((e) => e.slug === editingKpi.slug) : null}
        selectedWeek={selectedWeek}
        onSave={handleSaveManualEntry}
        selectedTeamMember={selectedTeamMember}
      />
    </div>
  );
}
