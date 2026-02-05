import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { formatWeekLabel } from "@/config/kpiConfig";

export default function KpiEntryDialog({ open, onClose, kpiDef, snapshot, selectedWeek, onSave, selectedTeamMember }) {
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (snapshot) {
      setValue(snapshot.actual_value !== null && snapshot.actual_value !== undefined ? String(snapshot.actual_value) : "");
      setNotes(snapshot.notes || "");
    } else {
      setValue("");
      setNotes("");
    }
  }, [snapshot, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        slug: kpiDef.slug,
        month: selectedWeek,
        actual_value: parseFloat(value) || 0,
        notes: notes || null,
        team_member_id: selectedTeamMember || null,
      });
      onClose();
    } catch (err) {
      console.error("Error saving KPI entry:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!kpiDef) return null;
  const Icon = kpiDef.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-gray-500" />
            {kpiDef.name}
          </DialogTitle>
          <p className="text-sm text-gray-500">{formatWeekLabel(selectedWeek)}</p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="kpi-value">Value</Label>
            <Input
              id="kpi-value"
              type="number"
              step={kpiDef.unit === "currency" ? "1" : "0.1"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Enter ${kpiDef.name.toLowerCase()}`}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kpi-notes">Notes (optional)</Label>
            <Textarea
              id="kpi-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any context about this metric..."
            />
          </div>
        </div>

        <DialogFooter>
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
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
