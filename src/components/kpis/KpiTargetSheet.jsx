import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Save, Loader2 } from "lucide-react";
import { KPI_DEFINITIONS, formatKpiValue, formatWeekLabel } from "@/config/kpiConfig";

export default function KpiTargetSheet({
  open,
  onClose,
  selectedWeek,
  currentEntries,
  previousEntries,
  onSave,
  selectedTeamMember,
  selectedMemberName,
}) {
  const [targets, setTargets] = useState({});
  const [bonuses, setBonuses] = useState({});
  const [saving, setSaving] = useState(false);

  // Filter KPIs based on team member selection
  const visibleKpis = selectedTeamMember
    ? KPI_DEFINITIONS.filter((k) => k.perMember)
    : KPI_DEFINITIONS;

  useEffect(() => {
    const initial = {};
    const initialBonuses = {};
    visibleKpis.forEach((kpi) => {
      const entry = currentEntries.find((e) => e.slug === kpi.slug);
      initial[kpi.slug] = entry?.target_value !== null && entry?.target_value !== undefined
        ? String(entry.target_value)
        : "";
      initialBonuses[kpi.slug] = entry?.bonus_amount ? String(entry.bonus_amount) : "";
    });
    setTargets(initial);
    setBonuses(initialBonuses);
  }, [currentEntries, open, selectedTeamMember]);

  const handleCopyFromLastWeek = () => {
    const updated = { ...targets };
    const updatedBonuses = { ...bonuses };
    visibleKpis.forEach((kpi) => {
      const prev = previousEntries.find((e) => e.slug === kpi.slug);
      if (prev?.target_value !== null && prev?.target_value !== undefined) {
        updated[kpi.slug] = String(prev.target_value);
      }
      if (prev?.bonus_amount) {
        updatedBonuses[kpi.slug] = String(prev.bonus_amount);
      }
    });
    setTargets(updated);
    setBonuses(updatedBonuses);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = visibleKpis
        .filter((kpi) => targets[kpi.slug] !== "")
        .map((kpi) => ({
          slug: kpi.slug,
          month: selectedWeek,
          target_value: parseFloat(targets[kpi.slug]) || 0,
          bonus_amount: bonuses[kpi.slug] ? parseFloat(bonuses[kpi.slug]) : null,
          team_member_id: selectedTeamMember || null,
        }));
      await onSave(entries);
      onClose();
    } catch (err) {
      console.error("Error saving targets:", err);
    } finally {
      setSaving(false);
    }
  };

  const categoryLabels = { revenue: "Revenue", leads: "Leads", social: "Social", operations: "Operations" };
  const grouped = {};
  visibleKpis.forEach((kpi) => {
    if (!grouped[kpi.category]) grouped[kpi.category] = [];
    grouped[kpi.category].push(kpi);
  });

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {selectedMemberName
              ? `Set Targets — ${selectedMemberName}`
              : "Set Weekly Targets"}
          </SheetTitle>
          <SheetDescription>{formatWeekLabel(selectedWeek)}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 mb-4">
          <Button variant="outline" size="sm" onClick={handleCopyFromLastWeek}>
            <Copy className="w-4 h-4 mr-2" />
            Copy from Last Week
          </Button>
        </div>

        <div className="space-y-6">
          {Object.entries(grouped).map(([category, kpis]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                {categoryLabels[category]}
              </h3>
              <div className="space-y-3">
                {kpis.map((kpi) => {
                  const Icon = kpi.icon;
                  const currentEntry = currentEntries.find((e) => e.slug === kpi.slug);
                  const currentActual = currentEntry?.actual_value;

                  return (
                    <div key={kpi.slug} className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs text-gray-600">{kpi.name}</Label>
                        {currentActual !== null && currentActual !== undefined && (
                          <span className="text-xs text-gray-400 ml-2">
                            Current: {formatKpiValue(currentActual, kpi.unit)}
                          </span>
                        )}
                      </div>
                      <Input
                        type="number"
                        step={kpi.unit === "currency" ? "1" : "0.1"}
                        className="w-28"
                        placeholder="Target"
                        value={targets[kpi.slug] || ""}
                        onChange={(e) => setTargets({ ...targets, [kpi.slug]: e.target.value })}
                      />
                      {kpi.perMember && selectedTeamMember && (
                        <Input
                          type="number"
                          step="1"
                          className="w-24"
                          placeholder="Bonus $"
                          value={bonuses[kpi.slug] || ""}
                          onChange={(e) => setBonuses({ ...bonuses, [kpi.slug]: e.target.value })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Targets
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
