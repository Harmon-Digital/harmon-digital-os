import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [inlineEditSlug, setInlineEditSlug] = useState(null);
  const [inlineTarget, setInlineTarget] = useState("");
  const [inlineBonus, setInlineBonus] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState(null);

  const currentEntries = allEntries.filter((e) => e.month === selectedWeek);
  const previousWeek = getPreviousWeek(selectedWeek);
  const previousEntries = allEntries.filter((e) => e.month === previousWeek);

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
  }, [selectedWeek, selectedTeamMember, teamMembers]);

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
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-[15px] font-semibold text-gray-900">Admin Access Required</h2>
          <p className="text-[13px] text-gray-500 mt-2">KPI tracking is only available to administrators.</p>
        </div>
      </div>
    );
  }

  const overallPct =
    summaryStats.withTargets > 0
      ? Math.round((summaryStats.goalsHit / summaryStats.withTargets) * 100)
      : null;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-4 h-12">
          <h1 className="text-[15px] font-semibold text-gray-900">KPIs</h1>
          <span className="text-[13px] text-gray-500">
            {selectedMemberName || "Weekly metrics"}
          </span>

          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            <Select
              value={selectedTeamMember || "company"}
              onValueChange={(v) => setSelectedTeamMember(v === "company" ? null : v)}
            >
              <SelectTrigger className="w-[160px] h-8 text-[13px]">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company (All)</SelectItem>
                {teamMembers.map((tm) => (
                  <SelectItem key={tm.id} value={tm.id}>{tm.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-0.5 border border-gray-200 rounded-md h-8 text-[12px]">
              <button
                type="button"
                onClick={() => navigateWeek(-1)}
                className="h-full px-1.5 text-gray-500 hover:text-gray-800"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-gray-700 min-w-[140px] text-center tabular-nums">
                {formatWeekLabel(selectedWeek)}
              </span>
              <button
                type="button"
                onClick={() => navigateWeek(1)}
                disabled={!canGoForward}
                className="h-full px-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {selectedWeek !== currentWeekStr && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[12px] h-8"
                onClick={() => setSelectedWeek(currentWeekStr)}
              >
                This Week
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[13px]"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Refresh
            </Button>
            <Button
              size="sm"
              className="h-8 bg-indigo-600 hover:bg-indigo-700"
              onClick={() => setShowTargetSheet(true)}
            >
              <Target className="w-3.5 h-3.5 mr-1.5" />
              Set Targets
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0">
        <div className="p-4 lg:p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Inline metric strip */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-gray-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Goals Tracked <span className="text-gray-900 font-medium">{summaryStats.withTargets}</span>
                  <span className="text-gray-400">/ {visibleKpis.length}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Goals Hit <span className="text-gray-900 font-medium">{summaryStats.goalsHit}</span>
                  <span className="text-gray-400">/ {summaryStats.withTargets}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Bonus Earned{" "}
                  <span className={`font-medium ${summaryStats.totalBonusEarned > 0 ? "text-green-600" : "text-gray-900"}`}>
                    ${summaryStats.totalBonusEarned.toLocaleString()}
                  </span>
                  {summaryStats.totalBonusPotential > 0 && (
                    <span className="text-gray-400">of ${summaryStats.totalBonusPotential.toLocaleString()}</span>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Progress <span className="text-gray-900 font-medium">{overallPct !== null ? `${overallPct}%` : "--"}</span>
                </span>
              </div>

              {/* KPI list */}
              <div className="border border-gray-200 rounded-md overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 px-3 h-8 border-b border-gray-200 bg-gray-50 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  <div className="flex-1 min-w-0">KPI</div>
                  <div className="w-20 text-right">Actual</div>
                  <div className="w-20 text-right">Target</div>
                  <div className="w-28 text-center">Progress</div>
                  <div className="w-20 text-right">Bonus</div>
                  <div className="w-16 text-center">vs Prev</div>
                  <div className="w-6"></div>
                </div>

                {visibleKpis.length === 0 ? (
                  <div className="text-center py-8 text-[13px] text-gray-500">
                    No KPIs to display.
                  </div>
                ) : (
                  (() => {
                    const categories = [...new Set(visibleKpis.map((k) => k.category))];
                    const rows = [];

                    categories.forEach((category) => {
                      const catKpis = visibleKpis.filter((k) => k.category === category);

                      rows.push(
                        <div
                          key={`cat-${category}`}
                          className="px-3 h-7 bg-gray-50/60 border-b border-gray-100 flex items-center"
                        >
                          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                            {CATEGORY_LABELS[category] || category}
                          </span>
                        </div>
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
                            <div
                              className={`flex items-center gap-3 px-3 py-2 border-b border-gray-100 cursor-pointer ${
                                isExpanded ? "bg-gray-50" : "hover:bg-gray-50"
                              }`}
                              onClick={() => setExpandedKpi(isExpanded ? null : kpi.slug)}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="text-[13px] font-medium text-gray-900 truncate">{kpi.name}</span>
                                {kpi.calcType === "auto" && (
                                  <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                                )}
                                {kpi.calcType === "manual" && (
                                  <button
                                    className="p-0.5 rounded hover:bg-gray-200 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingKpi(kpi);
                                    }}
                                  >
                                    <Pencil className="w-3 h-3 text-gray-400" />
                                  </button>
                                )}
                              </div>

                              <div className="w-20 text-right text-[13px] font-medium text-gray-900 tabular-nums">
                                {formatKpiValue(actual, kpi.unit)}
                              </div>

                              <div className="w-20 text-right" onClick={(e) => e.stopPropagation()}>
                                {inlineEditSlug === kpi.slug ? (
                                  <Input
                                    type="number"
                                    className="w-20 h-7 text-[12px] text-right tabular-nums ml-auto"
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
                                    className="text-[13px] text-gray-500 tabular-nums cursor-pointer hover:text-indigo-600 hover:underline decoration-dashed underline-offset-2"
                                    onClick={() => startInlineEdit(kpi)}
                                  >
                                    {targetNum !== null ? (
                                      formatKpiValue(targetNum, kpi.unit)
                                    ) : (
                                      <span className="text-gray-300 italic">set</span>
                                    )}
                                  </span>
                                )}
                              </div>

                              <div className="w-28 flex items-center gap-2 justify-center">
                                {pct !== null ? (
                                  <>
                                    <div className="w-14 h-1 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          pct >= 100
                                            ? "bg-green-500"
                                            : pct >= 50
                                            ? "bg-amber-500"
                                            : "bg-red-400"
                                        }`}
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                      />
                                    </div>
                                    <span
                                      className={`text-[11px] font-medium tabular-nums ${
                                        pct >= 100
                                          ? "text-green-600"
                                          : pct >= 50
                                          ? "text-amber-600"
                                          : "text-red-500"
                                      }`}
                                    >
                                      {pct}%
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[11px] text-gray-300">--</span>
                                )}
                              </div>

                              <div
                                className="w-20 text-right tabular-nums"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {inlineEditSlug === kpi.slug ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <Input
                                      type="number"
                                      className="w-16 h-7 text-[12px] text-right tabular-nums"
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
                                      className="p-1 rounded hover:bg-green-100 text-green-600"
                                    >
                                      {inlineSaving ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Check className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  <span
                                    className="cursor-pointer hover:text-indigo-600"
                                    onClick={() => startInlineEdit(kpi)}
                                  >
                                    {bonusAmt > 0 ? (
                                      <span
                                        className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                                          pct >= 100
                                            ? "bg-green-100 text-green-700 font-medium"
                                            : "bg-gray-100 text-gray-500"
                                        }`}
                                      >
                                        ${bonusAmt.toLocaleString()}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300 italic text-[11px]">set</span>
                                    )}
                                  </span>
                                )}
                              </div>

                              <div className="w-16 text-center">
                                {delta !== null ? (
                                  <span
                                    className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
                                      delta >= 0 ? "text-green-600" : "text-red-500"
                                    }`}
                                  >
                                    {delta >= 0 ? (
                                      <ArrowUp className="w-3 h-3" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3" />
                                    )}
                                    {delta >= 0 ? "+" : ""}
                                    {delta.toFixed(0)}%
                                  </span>
                                ) : (
                                  <Minus className="w-3 h-3 text-gray-300 mx-auto" />
                                )}
                              </div>

                              <div className="w-6 flex justify-center">
                                {pct >= 100 && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="px-3 py-2 bg-gray-50/60 border-b border-gray-100">
                                <div className="border border-gray-200 rounded-md p-3 bg-white">
                                  <div className="h-5 text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                                    {kpi.name} — 8 Week Trend
                                  </div>
                                  <KpiTrendChart
                                    kpiDef={kpi}
                                    data={getWeekRange(selectedWeek, 8).map((w) => {
                                      const entry = allEntries.find(
                                        (e) => e.slug === kpi.slug && e.month === w
                                      );
                                      return {
                                        month: w,
                                        actual_value: entry?.actual_value || 0,
                                        target_value: entry?.target_value ?? null,
                                      };
                                    })}
                                  />
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      });
                    });

                    return rows;
                  })()
                )}
              </div>

              {/* Empty state */}
              {!selectedTeamMember && currentEntries.length === 0 && (
                <div className="border border-gray-200 rounded-md py-10 text-center">
                  <RefreshCw className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-600 font-medium">
                    No data for {formatWeekLabel(selectedWeek)}
                  </p>
                  <p className="text-[12px] text-gray-400 mt-1">
                    Click "Refresh" to pull metrics from your data.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
