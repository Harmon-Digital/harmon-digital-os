import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Clock,
  TrendingUp,
  Building2,
  Plus,
  X,
  Loader2,
  Layers,
  Calendar as CalendarIcon,
  FileText,
  Tag,
  AlertCircle,
  GripVertical,
  Check,
  Hash,
  StickyNote,
  Briefcase,
  Repeat,
} from "lucide-react";
import { Account } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { toast } from "@/lib/toast";

/* -------------------------------------------------------------------------- */
/* PropertyRow — same pattern as TaskForm + ContactForm                        */
/* -------------------------------------------------------------------------- */
function PropertyRow({ icon: Icon, label, children, required = false, align = "center" }) {
  return (
    <div className={`flex ${align === "top" ? "items-start" : "items-center"} gap-3 min-h-[32px]`}>
      <div className={`flex items-center gap-1.5 w-28 shrink-0 text-[12px] text-gray-500 dark:text-gray-400 ${align === "top" ? "pt-1.5" : ""}`}>
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

const BILLING_OPTIONS = [
  { value: "retainer", label: "Retainer", icon: Repeat, description: "Monthly recurring" },
  { value: "fixed", label: "Fixed", icon: Layers, description: "Milestone-based project" },
  { value: "hourly", label: "Hourly", icon: Clock, description: "Bill by the hour" },
  { value: "exit", label: "Exit", icon: TrendingUp, description: "Retainer + success fee" },
];

const PROJECT_TYPES = [
  { value: "web_development", label: "Web Development" },
  { value: "mobile_app", label: "Mobile App" },
  { value: "automation", label: "Automation" },
  { value: "consulting", label: "Consulting" },
  { value: "design", label: "Design" },
  { value: "marketing", label: "Marketing" },
  { value: "maintenance", label: "Maintenance" },
  { value: "exit_systematization", label: "Exit Systematization" },
  { value: "internal", label: "Internal" },
  { value: "other", label: "Other" },
];

export default function ProjectForm({ project, accounts: initialAccounts, onSubmit, onAutoSave, onCancel }) {
  const isEdit = !!project?.id;
  const [accounts, setAccounts] = useState(initialAccounts || []);
  const [formData, setFormData] = useState(
    project || {
      name: "",
      account_id: "",
      description: "",
      status: "active",
      billing_type: "retainer",
      is_internal: false,
      hourly_rate: 0,
      monthly_retainer: 0,
      retainer_hours_included: 0,
      valuation_percentage: 8,
      baseline_valuation: 0,
      exit_target_date: "",
      engagement_months: 3,
      start_date: "",
      end_date: "",
      project_type: "consulting",
      total_budget: 0,
    },
  );

  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [newAccountData, setNewAccountData] = useState({ company_name: "", website: "" });
  const [creatingAccount, setCreatingAccount] = useState(false);

  /* ---- Phases state ---- */
  const [phases, setPhases] = useState([]);
  const [phasesLoading, setPhasesLoading] = useState(false);
  const [phaseSaveState, setPhaseSaveState] = useState("idle"); // idle | saving | saved | error
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [expandedPhase, setExpandedPhase] = useState(null); // index whose details are shown
  const phasesAutoSaveTimer = useRef(null);
  const phasesLastSerialized = useRef(null);
  const phasesFirstRun = useRef(true);

  // Load phases for existing projects
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    (async () => {
      setPhasesLoading(true);
      try {
        const { data } = await supabase
          .from("project_phases")
          .select("*")
          .eq("project_id", project.id)
          .order("order_index", { ascending: true });
        if (!cancelled) setPhases(data || []);
      } catch (err) {
        console.error("Phases load failed:", err);
      } finally {
        if (!cancelled) setPhasesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [project?.id]);

  const handleCreateAccount = async () => {
    if (!newAccountData.company_name.trim()) return;
    setCreatingAccount(true);
    try {
      const newAccount = await Account.create({
        company_name: newAccountData.company_name,
        website: newAccountData.website || null,
        status: "active",
      });
      setAccounts([...accounts, newAccount]);
      setFormData({ ...formData, account_id: newAccount.id, is_internal: false });
      setNewAccountData({ company_name: "", website: "" });
      setShowNewAccountForm(false);
      toast.success("Account created");
    } catch (err) {
      toast.error("Couldn't create account", { description: err.message });
    } finally {
      setCreatingAccount(false);
    }
  };

  const cleanData = useCallback((d = formData) => {
    const isInternal = !d.account_id;
    return {
      ...d,
      account_id: d.account_id || null,
      is_internal: isInternal,
      start_date: d.start_date || null,
      end_date: d.end_date || null,
      exit_target_date: d.exit_target_date || null,
      description: d.description || null,
      total_budget: d.total_budget === "" ? null : (Number(d.total_budget) || null),
    };
  }, [formData]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const result = await onSubmit(cleanData());
    // If we were creating a project and have staged phases, persist them now
    if (!isEdit && result?.id && phases.length > 0) {
      try {
        const rows = phases.map((p, i) => ({
          project_id: result.id,
          name: p.name || `Phase ${i + 1}`,
          description: p.description || null,
          amount: Number(p.amount) || 0,
          status: p.status || "planned",
          order_index: i,
          start_date: p.start_date || null,
          end_date: p.end_date || null,
        }));
        const { error: insertErr } = await supabase.from("project_phases").insert(rows);
        if (insertErr) throw insertErr;
      } catch (err) {
        console.error("Staged phases insert failed:", err);
        toast.error("Project created, but phases couldn't be saved", { description: err.message });
      }
    }
  };

  /* ---- Auto-save (edit mode only) ---- */
  const [saveState, setSaveState] = useState("idle");
  const autoSaveTimer = useRef(null);
  const lastSerialized = useRef(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!isEdit || !onAutoSave || showNewAccountForm) return;
    const serialized = JSON.stringify(cleanData());
    if (firstRun.current) {
      firstRun.current = false;
      lastSerialized.current = serialized;
      return;
    }
    if (serialized === lastSerialized.current) return;
    lastSerialized.current = serialized;

    setSaveState("saving");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await onAutoSave(JSON.parse(serialized));
        setSaveState("saved");
      } catch (err) {
        console.error("Auto-save failed:", err);
        setSaveState("error");
      }
    }, 500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [formData, isEdit, onAutoSave, showNewAccountForm, cleanData]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 1500);
    return () => clearTimeout(t);
  }, [saveState]);

  /* ---- Phases handlers ---- */
  const addPhase = (focus = true) => {
    const nextOrder = phases.length;
    const localId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setPhases((prev) => [
      ...prev,
      {
        _localId: localId,
        name: "",
        amount: 0,
        status: "planned",
        description: "",
        order_index: nextOrder,
      },
    ]);
    if (focus) {
      // focus the new row's name input on next tick
      setTimeout(() => {
        const el = document.querySelector(`[data-phase-local="${localId}"] input[data-phase-name]`);
        if (el) el.focus();
      }, 0);
    }
  };

  const updatePhase = (idx, field, value) => {
    setPhases((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const removePhase = async (idx) => {
    const phase = phases[idx];
    setPhases((prev) => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, order_index: i })));
    setExpandedPhase((cur) => {
      if (cur === null) return null;
      if (cur === idx) return null;
      return cur > idx ? cur - 1 : cur;
    });
    if (phase?.id && project?.id) {
      try {
        await supabase.from("project_phases").delete().eq("id", phase.id);
      } catch (err) {
        toast.error("Couldn't delete phase", { description: err.message });
      }
    }
  };

  const reorderPhase = (fromIdx, toIdx) => {
    if (fromIdx === toIdx || fromIdx == null || toIdx == null) return;
    setPhases((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next.map((p, i) => ({ ...p, order_index: i }));
    });
  };

  const splitEvenly = () => {
    if (phases.length === 0) return;
    const budget = Number(formData.total_budget) || phases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (budget <= 0) {
      toast.error("Set a total budget first");
      return;
    }
    const each = Math.floor((budget / phases.length) * 100) / 100;
    const remainder = +(budget - each * phases.length).toFixed(2);
    setPhases((prev) => prev.map((p, i) => ({
      ...p,
      amount: i === prev.length - 1 ? +(each + remainder).toFixed(2) : each,
    })));
  };

  // Auto-save phases (edit mode only) — debounced
  useEffect(() => {
    if (!isEdit || !project?.id) return;
    const serialized = JSON.stringify(phases.map((p) => ({
      id: p.id || null,
      _localId: p._localId || null,
      name: p.name || "",
      description: p.description || "",
      amount: Number(p.amount) || 0,
      status: p.status || "planned",
      start_date: p.start_date || null,
      end_date: p.end_date || null,
      order_index: p.order_index ?? 0,
    })));
    if (phasesFirstRun.current) {
      phasesFirstRun.current = false;
      phasesLastSerialized.current = serialized;
      return;
    }
    if (serialized === phasesLastSerialized.current) return;
    phasesLastSerialized.current = serialized;

    setPhaseSaveState("saving");
    if (phasesAutoSaveTimer.current) clearTimeout(phasesAutoSaveTimer.current);
    phasesAutoSaveTimer.current = setTimeout(async () => {
      try {
        for (const [i, phase] of phases.entries()) {
          const payload = {
            project_id: project.id,
            name: phase.name || `Phase ${i + 1}`,
            description: phase.description || null,
            amount: Number(phase.amount) || 0,
            status: phase.status || "planned",
            order_index: i,
            start_date: phase.start_date || null,
            end_date: phase.end_date || null,
          };
          if (phase.id) {
            await supabase.from("project_phases").update(payload).eq("id", phase.id);
          } else {
            const { data } = await supabase
              .from("project_phases")
              .insert(payload)
              .select()
              .single();
            if (data) {
              setPhases((prev) => prev.map((p) => (p._localId === phase._localId ? { ...data } : p)));
            }
          }
        }
        setPhaseSaveState("saved");
      } catch (err) {
        console.error("Phase auto-save failed:", err);
        setPhaseSaveState("error");
        toast.error("Couldn't save phases", { description: err.message });
      }
    }, 600);
    return () => {
      if (phasesAutoSaveTimer.current) clearTimeout(phasesAutoSaveTimer.current);
    };
  }, [phases, isEdit, project?.id]);

  useEffect(() => {
    if (phaseSaveState !== "saved") return;
    const t = setTimeout(() => setPhaseSaveState("idle"), 1500);
    return () => clearTimeout(t);
  }, [phaseSaveState]);

  const phasesTotal = phases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const budgetNum = Number(formData.total_budget) || 0;
  const budgetDelta = budgetNum - phasesTotal;

  return (
    <>
      <style>{`
        .project-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        .project-form textarea,
        .project-form [role="combobox"] {
          border-color: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          transition: background-color 0.12s ease, border-color 0.12s ease;
        }
        .project-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):hover,
        .project-form textarea:hover,
        .project-form [role="combobox"]:hover {
          background-color: rgb(249 250 251) !important;
        }
        .dark .project-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):hover,
        .dark .project-form textarea:hover,
        .dark .project-form [role="combobox"]:hover {
          background-color: rgb(31 41 55) !important;
        }
        .project-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus,
        .project-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus-visible,
        .project-form textarea:focus,
        .project-form textarea:focus-visible,
        .project-form [role="combobox"]:focus,
        .project-form [role="combobox"][data-state="open"] {
          background-color: white !important;
          border-color: rgb(199 210 254) !important;
          box-shadow: 0 0 0 3px rgb(224 231 255 / 0.45) !important;
          outline: none !important;
        }
        .dark .project-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus,
        .dark .project-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus-visible,
        .dark .project-form textarea:focus,
        .dark .project-form textarea:focus-visible,
        .dark .project-form [role="combobox"]:focus,
        .dark .project-form [role="combobox"][data-state="open"] {
          background-color: rgb(17 24 39) !important;
          border-color: rgb(67 56 202) !important;
          box-shadow: 0 0 0 3px rgb(49 46 129 / 0.35) !important;
        }
        .project-form .title-input {
          font-size: 22px !important;
          font-weight: 600 !important;
          padding: 4px 8px !important;
          height: auto !important;
          line-height: 1.3 !important;
        }
        .project-form .phase-row input,
        .project-form .phase-row textarea {
          background-color: transparent !important;
        }
      `}</style>

      <form onSubmit={handleSubmit} className="project-form space-y-4">
        {/* Name as title */}
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Project name"
          required
          className="title-input text-gray-900 dark:text-gray-100 w-full"
        />

        {/* Account + new account inline */}
        <div className="space-y-1 border-t border-gray-100 dark:border-gray-800 pt-3">
          <PropertyRow icon={Building2} label="Client">
            {!showNewAccountForm ? (
              <div className="flex gap-1.5">
                <Select
                  value={formData.account_id || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      account_id: value === "none" ? "" : value,
                      is_internal: value === "none",
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-[13px] flex-1">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Internal (no client)</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => setShowNewAccountForm(true)}
                  className="inline-flex items-center gap-1 px-2 h-8 rounded-md border border-gray-200 dark:border-gray-700 text-[12px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  title="New account"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="p-2 border border-gray-200 dark:border-gray-800 rounded-md bg-gray-50/50 dark:bg-gray-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">New client account</span>
                  <button
                    type="button"
                    onClick={() => { setShowNewAccountForm(false); setNewAccountData({ company_name: "", website: "" }); }}
                    className="p-0.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-800"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Input
                  placeholder="Company name *"
                  value={newAccountData.company_name}
                  onChange={(e) => setNewAccountData({ ...newAccountData, company_name: e.target.value })}
                  autoFocus
                  className="h-7 text-[13px]"
                />
                <Input
                  placeholder="Website (optional)"
                  value={newAccountData.website}
                  onChange={(e) => setNewAccountData({ ...newAccountData, website: e.target.value })}
                  className="h-7 text-[13px]"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateAccount}
                  disabled={!newAccountData.company_name.trim() || creatingAccount}
                  className="w-full h-7 text-[13px] bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900"
                >
                  {creatingAccount ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Creating…</> : <>Create account</>}
                </Button>
              </div>
            )}
          </PropertyRow>

          <PropertyRow icon={Tag} label="Type">
            <Select value={formData.project_type} onValueChange={(v) => setFormData({ ...formData, project_type: v })}>
              <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropertyRow>

          <PropertyRow icon={Hash} label="Status">
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </PropertyRow>

          <PropertyRow icon={CalendarIcon} label="Dates">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={formData.start_date || ""}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="h-8 text-[13px] flex-1"
                placeholder="Start"
              />
              <span className="text-gray-400 text-[12px]">→</span>
              <Input
                type="date"
                value={formData.end_date || ""}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="h-8 text-[13px] flex-1"
                placeholder="End"
              />
            </div>
          </PropertyRow>
        </div>

        {/* Billing Type — compact horizontal pills */}
        {formData.account_id && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
            <PropertyRow icon={DollarSign} label="Billing" align="top">
              <div className="grid grid-cols-4 gap-1.5">
                {BILLING_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = formData.billing_type === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, billing_type: option.value })}
                      className={`flex flex-col items-start gap-0.5 p-2 rounded-md border text-left transition-all ${
                        isSelected
                          ? "border-indigo-400 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`} />
                      <div className={`text-[12px] font-medium ${isSelected ? "text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"}`}>
                        {option.label}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{option.description}</div>
                    </button>
                  );
                })}
              </div>
            </PropertyRow>
          </div>
        )}

        {/* Billing-specific fields */}
        {formData.account_id && (
          <div className="space-y-1 border-t border-gray-100 dark:border-gray-800 pt-3">
            {formData.billing_type === "hourly" && (
              <PropertyRow label="Rate">
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-7 h-8 text-[13px]"
                    value={formData.hourly_rate || ""}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                    placeholder="150 per hour"
                  />
                </div>
              </PropertyRow>
            )}

            {formData.billing_type === "retainer" && (
              <>
                <PropertyRow label="Retainer">
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <Input
                      type="number"
                      step="0.01"
                      className="pl-7 h-8 text-[13px]"
                      value={formData.monthly_retainer || ""}
                      onChange={(e) => setFormData({ ...formData, monthly_retainer: parseFloat(e.target.value) || 0 })}
                      placeholder="2500 per month"
                    />
                  </div>
                </PropertyRow>
                <PropertyRow label="Hours included">
                  <Input
                    type="number"
                    value={formData.retainer_hours_included || ""}
                    onChange={(e) => setFormData({ ...formData, retainer_hours_included: parseFloat(e.target.value) || 0 })}
                    placeholder="20 (optional)"
                    className="h-8 text-[13px]"
                  />
                </PropertyRow>
              </>
            )}

            {formData.billing_type === "fixed" && (
              <PropertyRow label="Total budget">
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-7 h-8 text-[13px]"
                    value={formData.total_budget || ""}
                    onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                    placeholder="98000"
                  />
                </div>
              </PropertyRow>
            )}

            {formData.billing_type === "exit" && (
              <>
                <PropertyRow label="Retainer">
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <Input
                      type="number"
                      step="0.01"
                      className="pl-7 h-8 text-[13px]"
                      value={formData.monthly_retainer || ""}
                      onChange={(e) => setFormData({ ...formData, monthly_retainer: parseFloat(e.target.value) || 0 })}
                      placeholder="2500 per month"
                    />
                  </div>
                </PropertyRow>
                <PropertyRow label="Success fee">
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      className="h-8 text-[13px] pr-7"
                      value={formData.valuation_percentage || ""}
                      onChange={(e) => setFormData({ ...formData, valuation_percentage: parseFloat(e.target.value) || 0 })}
                      placeholder="8"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[12px]">%</span>
                  </div>
                </PropertyRow>
                <PropertyRow label="Baseline valuation">
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <Input
                      type="number"
                      className="pl-7 h-8 text-[13px]"
                      value={formData.baseline_valuation || ""}
                      onChange={(e) => setFormData({ ...formData, baseline_valuation: parseFloat(e.target.value) || 0 })}
                      placeholder="2000000"
                    />
                  </div>
                </PropertyRow>
                <PropertyRow label="Engagement">
                  <Select
                    value={String(formData.engagement_months || 3)}
                    onValueChange={(v) => setFormData({ ...formData, engagement_months: parseInt(v) })}
                  >
                    <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 month</SelectItem>
                      <SelectItem value="2">2 months</SelectItem>
                      <SelectItem value="3">3 months</SelectItem>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months</SelectItem>
                    </SelectContent>
                  </Select>
                </PropertyRow>
                <PropertyRow label="Target exit">
                  <Input
                    type="date"
                    value={formData.exit_target_date || ""}
                    onChange={(e) => setFormData({ ...formData, exit_target_date: e.target.value })}
                    className="h-8 text-[13px]"
                  />
                </PropertyRow>
              </>
            )}
          </div>
        )}

        {/* Phases manager — only for fixed billing type */}
        {formData.account_id && formData.billing_type === "fixed" && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300">Phases</span>
              {phases.length > 0 && (
                <span className="text-[11px] text-gray-400 tabular-nums">{phases.length}</span>
              )}
              <span className="ml-auto flex items-center gap-1">
                {isEdit && phaseSaveState !== "idle" && (
                  <span className={`text-[11px] tabular-nums ${phaseSaveState === "error" ? "text-red-600" : "text-gray-400"}`}>
                    {phaseSaveState === "saving" && "Saving…"}
                    {phaseSaveState === "saved" && "✓ Saved"}
                    {phaseSaveState === "error" && "Save failed"}
                  </span>
                )}
                {phases.length > 1 && (
                  <button
                    type="button"
                    onClick={splitEvenly}
                    className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 px-2 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    title={`Divide ${formData.total_budget ? `$${Number(formData.total_budget).toLocaleString()}` : "total"} evenly across phases`}
                  >
                    Split evenly
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => addPhase(true)}
                  className="inline-flex items-center gap-1 text-[12px] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-2 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Plus className="w-3 h-3" />
                  Add phase
                </button>
              </span>
            </div>

            {phasesLoading ? (
              <div className="py-6 text-center text-[12px] text-gray-400">Loading phases…</div>
            ) : phases.length === 0 ? (
              <button
                type="button"
                onClick={() => addPhase(true)}
                className="w-full py-4 text-center text-[12px] text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-800 rounded-md hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                Add first phase
                <div className="mt-1 text-[11px] text-gray-400">
                  e.g. Discovery · $20k → Build · $58k → Launch · $20k
                </div>
              </button>
            ) : (
              <div className="space-y-1">
                {phases.map((phase, idx) => (
                  <PhaseRow
                    key={phase.id || phase._localId}
                    phase={phase}
                    index={idx}
                    total={phases.length}
                    expanded={expandedPhase === idx}
                    isDragOver={dragOverIdx === idx && dragIdx !== idx}
                    onUpdate={(field, value) => updatePhase(idx, field, value)}
                    onRemove={() => removePhase(idx)}
                    onToggleExpand={() => setExpandedPhase((cur) => (cur === idx ? null : idx))}
                    onEnterAddNext={() => {
                      if (idx === phases.length - 1) addPhase(true);
                      else {
                        // focus next row's name
                        const nextLocal = phases[idx + 1]?._localId || phases[idx + 1]?.id;
                        const el = document.querySelector(`[data-phase-local="${nextLocal}"] input[data-phase-name]`);
                        if (el) el.focus();
                      }
                    }}
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={() => setDragOverIdx(idx)}
                    onDrop={() => {
                      reorderPhase(dragIdx, idx);
                      setDragIdx(null);
                      setDragOverIdx(null);
                    }}
                    onDragEnd={() => {
                      setDragIdx(null);
                      setDragOverIdx(null);
                    }}
                  />
                ))}
              </div>
            )}

            {/* Reconciliation strip */}
            {phases.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1.5 rounded-md bg-gray-50 dark:bg-gray-900/60 text-[12px]">
                <span className="text-gray-500 dark:text-gray-400">
                  Phases total <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">${phasesTotal.toLocaleString()}</span>
                </span>
                {budgetNum > 0 && (
                  <>
                    <span className="text-gray-500 dark:text-gray-400">
                      Budget <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">${budgetNum.toLocaleString()}</span>
                    </span>
                    <span
                      className={`font-medium tabular-nums ${
                        Math.abs(budgetDelta) < 0.01 ? "text-green-600 dark:text-green-400"
                          : budgetDelta > 0 ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {Math.abs(budgetDelta) < 0.01
                        ? "✓ balanced"
                        : budgetDelta > 0
                          ? `$${Math.abs(budgetDelta).toLocaleString()} unallocated`
                          : `$${Math.abs(budgetDelta).toLocaleString()} over budget`}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
          <PropertyRow icon={StickyNote} label="Notes" align="top">
            <Textarea
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Scope, goals, or anything worth remembering…"
              className="resize-none text-[13px]"
            />
          </PropertyRow>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
          {isEdit ? (
            <>
              <span className="mr-auto text-[11px] text-gray-400 tabular-nums">
                {saveState === "saving" && "Saving…"}
                {saveState === "saved" && "✓ All changes saved"}
                {saveState === "error" && <span className="text-red-600">Save failed — changes may be lost</span>}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 text-[13px]">
                Close
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 text-[13px]">
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-[13px] bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900"
              >
                Create project
              </Button>
            </>
          )}
        </div>
      </form>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* PhaseRow — compact milestone editor                                         */
/* -------------------------------------------------------------------------- */
const PHASE_STATUS = [
  { id: "planned", label: "Planned", color: "bg-gray-400" },
  { id: "in_progress", label: "In progress", color: "bg-blue-500" },
  { id: "completed", label: "Completed", color: "bg-green-500" },
  { id: "invoiced", label: "Invoiced", color: "bg-amber-500" },
  { id: "paid", label: "Paid", color: "bg-emerald-600" },
  { id: "cancelled", label: "Cancelled", color: "bg-red-500" },
];

function PhaseRow({
  phase,
  index,
  expanded,
  isDragOver,
  onUpdate,
  onRemove,
  onToggleExpand,
  onEnterAddNext,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  const statusMeta = PHASE_STATUS.find((s) => s.id === phase.status) || PHASE_STATUS[0];
  const hasDetails = phase.description || phase.start_date || phase.end_date;

  return (
    <div
      data-phase-local={phase._localId || phase.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      className={`phase-row group border rounded-md bg-white dark:bg-gray-900/50 transition-colors ${
        isDragOver
          ? "border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900/40"
          : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
      }`}
    >
      {/* Compact top row — always visible */}
      <div className="flex items-center gap-1.5 p-1.5">
        {/* Drag handle + numbered badge (combined) */}
        <div
          className="flex items-center gap-1 flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
          title="Drag to reorder"
        >
          <GripVertical className="w-3 h-3 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400" />
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">
            {index + 1}
          </span>
        </div>

        {/* Status dot-picker */}
        <Select value={phase.status} onValueChange={(v) => onUpdate("status", v)}>
          <SelectTrigger
            className="h-7 w-7 p-0 justify-center border-transparent bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0 [&>svg]:hidden"
            title={statusMeta.label}
          >
            <span className={`w-2 h-2 rounded-full ${statusMeta.color}`} />
          </SelectTrigger>
          <SelectContent>
            {PHASE_STATUS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                  {s.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Name */}
        <Input
          data-phase-name
          value={phase.name}
          onChange={(e) => onUpdate("name", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnterAddNext();
            }
          }}
          placeholder={`Phase ${index + 1} name`}
          className="h-7 text-[13px] flex-1 font-medium min-w-0"
        />

        {/* Amount */}
        <div className="relative w-28 flex-shrink-0">
          <DollarSign className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          <Input
            type="number"
            step="0.01"
            value={phase.amount || ""}
            onChange={(e) => onUpdate("amount", parseFloat(e.target.value) || 0)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnterAddNext();
              }
            }}
            placeholder="0"
            className="h-7 text-[13px] pl-5 text-right tabular-nums"
          />
        </div>

        {/* Expand (for details) */}
        <button
          type="button"
          onClick={onToggleExpand}
          className={`p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0 ${
            hasDetails ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          title={expanded ? "Hide details" : "Details (dates, description)"}
        >
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded flex-shrink-0"
          title="Remove phase"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="px-1.5 pb-2 pt-0 space-y-1.5 border-t border-gray-100 dark:border-gray-800 mt-0.5">
          <div className="flex items-center gap-1.5 pt-1.5">
            <span className="text-[11px] text-gray-400 w-16 flex-shrink-0">Dates</span>
            <Input
              type="date"
              value={phase.start_date || ""}
              onChange={(e) => onUpdate("start_date", e.target.value)}
              className="h-6 text-[11px] flex-1"
            />
            <span className="text-gray-400 text-[11px]">→</span>
            <Input
              type="date"
              value={phase.end_date || ""}
              onChange={(e) => onUpdate("end_date", e.target.value)}
              className="h-6 text-[11px] flex-1"
            />
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-[11px] text-gray-400 w-16 flex-shrink-0 pt-1">Notes</span>
            <Textarea
              value={phase.description || ""}
              onChange={(e) => onUpdate("description", e.target.value)}
              placeholder="Scope or deliverables for this phase…"
              rows={2}
              className="text-[12px] resize-none flex-1"
            />
          </div>
        </div>
      )}
    </div>
  );
}
