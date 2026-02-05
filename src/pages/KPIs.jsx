import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Target,
  Pencil,
  Loader2,
  ArrowUp,
  ArrowDown,
  Minus,
  Zap,
  DollarSign,
  Users,
  Share2,
  Settings,
} from "lucide-react";
import {
  KPI_DEFINITIONS,
  getHeroKpis,
  formatKpiValue,
  toWeekStart,
  formatWeekLabel,
} from "@/config/kpiConfig";
import { calculateAllAutoKpis, saveEntries, fetchEntriesForRange } from "@/api/kpiCalculations";
import { TeamMember } from "@/api/supabaseEntities";
import KpiScorecard from "@/components/kpis/KpiScorecard";
import KpiTrendChart from "@/components/kpis/KpiTrendChart";
import KpiTargetSheet from "@/components/kpis/KpiTargetSheet";
import KpiEntryDialog from "@/components/kpis/KpiEntryDialog";

const CATEGORY_META = {
  revenue: { label: "Revenue", icon: DollarSign, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  leads: { label: "Leads", icon: Target, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  social: { label: "Social Media", icon: Share2, color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-200" },
  operations: { label: "Operations", icon: Settings, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
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
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState(null);

  const currentEntries = allEntries.filter((e) => e.month === selectedWeek);
  const previousWeek = getPreviousWeek(selectedWeek);
  const previousEntries = allEntries.filter((e) => e.month === previousWeek);

  // Filter KPI definitions based on selected team member
  const visibleKpis = selectedTeamMember
    ? KPI_DEFINITIONS.filter((k) => k.perMember)
    : KPI_DEFINITIONS;

  const visibleHeroKpis = selectedTeamMember
    ? getHeroKpis().filter((k) => k.perMember)
    : getHeroKpis();

  // Group visible KPIs by category
  const grouped = {};
  visibleKpis.forEach((kpi) => {
    if (!grouped[kpi.category]) grouped[kpi.category] = [];
    grouped[kpi.category].push(kpi);
  });

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
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">KPIs</h1>
          <p className="text-gray-500 mt-1">
            {selectedMemberName
              ? `${selectedMemberName} — Individual KPIs`
              : "Track your weekly business metrics"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Team member selector */}
          <Select
            value={selectedTeamMember || "company"}
            onValueChange={(v) => setSelectedTeamMember(v === "company" ? null : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="company">Company (All)</SelectItem>
              {teamMembers.map((tm) => (
                <SelectItem key={tm.id} value={tm.id}>
                  {tm.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Week navigation */}
          <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium px-2 min-w-[160px] text-center">
              {formatWeekLabel(selectedWeek)}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateWeek(1)} disabled={!canGoForward}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowTargetSheet(true)}>
            <Target className="w-4 h-4 mr-2" />
            Set Targets
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
                <div className="h-8 bg-gray-200 rounded w-20 mb-2" />
                <div className="h-2 bg-gray-200 rounded w-full" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-28 mb-4" />
                <div className="space-y-3">
                  <div className="h-10 bg-gray-100 rounded" />
                  <div className="h-10 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Hero Scorecards */}
          {visibleHeroKpis.length > 0 && (
            <div className={`grid grid-cols-2 md:grid-cols-3 ${visibleHeroKpis.length <= 3 ? "lg:grid-cols-3" : "lg:grid-cols-5"} gap-4 mb-6`}>
              {visibleHeroKpis.map((kpi) => (
                <KpiScorecard
                  key={kpi.slug}
                  kpiDef={kpi}
                  actual={Number(getEntryValue(kpi.slug, "actual_value")) || 0}
                  target={getEntryValue(kpi.slug, "target_value") !== null ? Number(getEntryValue(kpi.slug, "target_value")) : null}
                  previousActual={getPreviousValue(kpi.slug)}
                  bonusAmount={Number(getEntryValue(kpi.slug, "bonus_amount")) || 0}
                />
              ))}
            </div>
          )}

          {/* Category Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(grouped).map(([category, kpis]) => {
              const meta = CATEGORY_META[category];
              if (!meta) return null;
              const CatIcon = meta.icon;

              return (
                <Card key={category} className="overflow-hidden">
                  <CardHeader className={`py-3 px-4 ${meta.bg} border-b ${meta.border}`}>
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <CatIcon className={`w-4 h-4 ${meta.color}`} />
                      {meta.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {kpis.map((kpi, idx) => {
                      const Icon = kpi.icon;
                      const actual = Number(getEntryValue(kpi.slug, "actual_value")) || 0;
                      const target = getEntryValue(kpi.slug, "target_value");
                      const targetNum = target !== null && target !== undefined ? Number(target) : null;
                      const pct = targetNum ? Math.round((actual / targetNum) * 100) : null;
                      const prevActual = getPreviousValue(kpi.slug);
                      let delta = null;
                      if (prevActual !== null && prevActual !== 0) {
                        delta = ((actual - prevActual) / prevActual) * 100;
                      } else if (prevActual === 0 && actual > 0) {
                        delta = 100;
                      }
                      const isExpanded = expandedKpi === kpi.slug;

                      return (
                        <div key={kpi.slug} className={idx < kpis.length - 1 ? "border-b" : ""}>
                          <div
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => setExpandedKpi(isExpanded ? null : kpi.slug)}
                          >
                            {/* KPI name + type */}
                            <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-gray-900 truncate">{kpi.name}</span>
                                {kpi.calcType === "auto" && (
                                  <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                                )}
                              </div>
                            </div>

                            {/* Value / Target */}
                            <span className="text-sm font-semibold tabular-nums shrink-0">
                              <span className="text-gray-900">{formatKpiValue(actual, kpi.unit)}</span>
                              {targetNum !== null && (
                                <span className="text-gray-400 font-normal"> / {formatKpiValue(targetNum, kpi.unit)}</span>
                              )}
                            </span>

                            {/* Progress bar */}
                            {targetNum !== null && (
                              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-500" : "bg-red-400"
                                  }`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            )}

                            {/* Target progress */}
                            {pct !== null ? (
                              <span className={`text-xs font-medium w-10 text-right tabular-nums ${
                                pct >= 100 ? "text-green-600" : pct >= 70 ? "text-amber-600" : "text-red-500"
                              }`}>
                                {pct}%
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300 w-10 text-right">--</span>
                            )}

                            {/* Bonus badge */}
                            {(() => {
                              const bonusAmt = Number(getEntryValue(kpi.slug, "bonus_amount")) || 0;
                              if (bonusAmt <= 0) return null;
                              return (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${
                                  pct >= 100 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                                }`}>
                                  ${bonusAmt}
                                </span>
                              );
                            })()}

                            {/* WoW delta */}
                            {delta !== null ? (
                              <span className={`flex items-center gap-0.5 text-xs font-medium w-14 justify-end ${delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                                {delta >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="w-14 flex justify-end">
                                <Minus className="w-3 h-3 text-gray-300" />
                              </span>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {kpi.calcType === "manual" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => { e.stopPropagation(); setEditingKpi(kpi); }}
                                >
                                  <Pencil className="w-3.5 h-3.5 text-gray-400" />
                                </Button>
                              )}
                              <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                          </div>

                          {/* Expanded chart */}
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t bg-gray-50/50">
                              <div className="pt-2">
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
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Empty state */}
          {!selectedTeamMember && currentEntries.length === 0 && (
            <div className="text-center py-6 text-gray-500 bg-white rounded-lg border mt-4">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium">No data for {formatWeekLabel(selectedWeek)}</p>
              <p className="text-xs mt-1">Click "Refresh" to pull metrics from your data.</p>
            </div>
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
