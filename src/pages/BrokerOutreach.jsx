import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import FormShell from "@/components/ui/FormShell";
import {
  Plus,
  Search,
  Trash2,
  ExternalLink,
  Check,
  X,
  PhoneCall,
  Mail,
  Linkedin,
  Trophy,
  TrendingUp,
  Settings,
  MessageSquare,
  HelpCircle,
  Info,
  Copy,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toWeekStart } from "@/config/kpiConfig";
import { saveEntries } from "@/api/kpiCalculations";

const STATUS_OPTIONS = [
  { value: "new", label: "New", dot: "bg-gray-400", text: "text-gray-600 dark:text-gray-400" },
  { value: "contacted", label: "Contacted", dot: "bg-blue-500", text: "text-blue-600" },
  { value: "responded", label: "Responded", dot: "bg-purple-500", text: "text-purple-600" },
  { value: "call_booked", label: "Call Booked", dot: "bg-yellow-500", text: "text-yellow-700" },
  { value: "call_complete", label: "Call Complete", dot: "bg-indigo-500", text: "text-indigo-600" },
  { value: "signed_up", label: "Signed Up", dot: "bg-cyan-500", text: "text-cyan-600" },
  { value: "partnered", label: "Partnered", dot: "bg-green-500", text: "text-green-600" },
  { value: "dead", label: "Dead", dot: "bg-red-500", text: "text-red-600" },
];

const REACH_OUT_TYPES = [
  { value: "call", label: "Call", icon: PhoneCall },
  { value: "email", label: "Email", icon: Mail },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "meeting", label: "Meeting", icon: MessageSquare },
];

const VIEWS = [
  { id: "all", label: "All" },
  { id: "need_contact", label: "New" },
  { id: "needs_follow_up", label: "Follow Up" },
  { id: "active", label: "Active" },
  { id: "partners", label: "Partners" },
];

const FOLLOW_UP_DAYS_OPTIONS = [
  { value: 3, label: "3+ days" },
  { value: 5, label: "5+ days" },
  { value: 7, label: "7+ days" },
  { value: 14, label: "14+ days" },
  { value: 30, label: "30+ days" },
];

export default function BrokerOutreach() {
  const { user } = useAuth();
  const [brokers, setBrokers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [kpiEntries, setKpiEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState("all");
  const [followUpDays, setFollowUpDays] = useState(5);
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showKpiSettings, setShowKpiSettings] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [inlineCreate, setInlineCreate] = useState({ name: "", firm: "", email: "", status: "new", last_contact: "", next_action: "", linkedin_url: "" });
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    firm: "",
    email: "",
    status: "new",
    last_contact: "",
    next_action: "",
    linkedin_url: "",
    notes: "",
  });

  // Reach out dialog
  const [showReachOutDialog, setShowReachOutDialog] = useState(false);
  const [reachOutBroker, setReachOutBroker] = useState(null);
  const [reachOutType, setReachOutType] = useState("call");
  const [reachOutBy, setReachOutBy] = useState("");
  const [reachOutNote, setReachOutNote] = useState("");
  const [savingReachOut, setSavingReachOut] = useState(false);

  // KPI settings
  const [kpiMember, setKpiMember] = useState(null);
  const [kpiDailyGoal, setKpiDailyGoal] = useState(0);
  const [kpiWeeklyGoal, setKpiWeeklyGoal] = useState(0);
  const [kpiBonus, setKpiBonus] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentWeekStart = toWeekStart(new Date());
      const [brokersRes, teamRes, activitiesRes, kpiRes] = await Promise.all([
        supabase.from("brokers").select("*").order("created_at", { ascending: false }),
        supabase.from("team_members").select("*").eq("status", "active"),
        supabase.from("broker_activities").select("*, team_members(full_name)").order("created_at", { ascending: false }),
        supabase.from("kpi_entries").select("*").eq("slug", "brokers_contacted").eq("month", currentWeekStart).not("team_member_id", "is", null),
      ]);

      setBrokers(brokersRes.data || []);
      setTeamMembers(teamRes.data || []);
      setActivities(activitiesRes.data || []);
      setKpiEntries(kpiRes.data || []);
    } catch (error) {
      console.error("Error loading broker data:", error);
    } finally {
      setLoading(false);
    }
  };

  const kpiStats = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekStartStr = toWeekStart(today);
    const startOfWeek = new Date(weekStartStr + "T00:00:00");

    return teamMembers
      .map(member => {
        const kpiEntry = kpiEntries.find(e => e.team_member_id === member.id);
        const weeklyGoal = kpiEntry ? Number(kpiEntry.target_value) || 0 : 0;
        const bonusAmount = kpiEntry ? Number(kpiEntry.bonus_amount) || 0 : 0;

        if (weeklyGoal <= 0) return null;

        const dailyGoal = Math.ceil(weeklyGoal / 5);
        const memberActivities = activities.filter(a => a.team_member_id === member.id);
        const todayCount = memberActivities.filter(a => new Date(a.created_at) >= startOfDay).length;
        const weekCount = memberActivities.filter(a => new Date(a.created_at) >= startOfWeek).length;

        const dailyProgress = dailyGoal > 0 ? (todayCount / dailyGoal) * 100 : 0;
        const weeklyProgress = weeklyGoal > 0 ? (weekCount / weeklyGoal) * 100 : 0;
        const dayOfWeek = today.getDay();
        const workingDaysPassed = dayOfWeek === 0 ? 5 : Math.min(dayOfWeek, 5);
        const expectedProgress = (workingDaysPassed / 5) * 100;
        const onTrackForBonus = weeklyProgress >= 100 || weeklyProgress >= expectedProgress;

        return {
          ...member,
          todayCount,
          weekCount,
          dailyGoal,
          weeklyGoal,
          bonusAmount,
          dailyProgress: Math.min(dailyProgress, 100),
          weeklyProgress: Math.min(weeklyProgress, 100),
          onTrackForBonus,
        };
      })
      .filter(Boolean);
  }, [teamMembers, activities, kpiEntries]);

  const handleLogReachOut = async () => {
    if (!reachOutBroker || !reachOutBy) return;

    setSavingReachOut(true);
    try {
      const { error: activityError } = await supabase.from("broker_activities").insert({
        broker_id: reachOutBroker.id,
        team_member_id: reachOutBy,
        type: reachOutType,
        description: reachOutNote,
      });
      if (activityError) throw activityError;

      const updates = {
        last_contact: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      };
      if (reachOutBroker.status === "new") {
        updates.status = "contacted";
      }
      const { error: brokerError } = await supabase.from("brokers").update(updates).eq("id", reachOutBroker.id);
      if (brokerError) throw brokerError;

      setShowReachOutDialog(false);
      setReachOutBroker(null);
      setReachOutType("call");
      setReachOutBy("");
      setReachOutNote("");
      loadData();
    } catch (error) {
      console.error("Error logging reach out:", error);
    } finally {
      setSavingReachOut(false);
    }
  };

  const handleSaveKpi = async () => {
    if (!kpiMember) return;

    const currentWeekStart = toWeekStart(new Date());
    const existingStat = kpiStats.find(s => s.id === kpiMember.id);

    await saveEntries([{
      slug: "brokers_contacted",
      month: currentWeekStart,
      actual_value: existingStat?.weekCount || 0,
      target_value: kpiWeeklyGoal,
      bonus_amount: kpiBonus || null,
      team_member_id: kpiMember.id,
    }]);

    setShowKpiSettings(false);
    setKpiMember(null);
    loadData();
  };

  const openKpiSettings = (member) => {
    setKpiMember(member);
    const kpiEntry = kpiEntries.find(e => e.team_member_id === member.id);
    const weeklyGoal = kpiEntry ? Number(kpiEntry.target_value) || 0 : 0;
    setKpiDailyGoal(Math.ceil(weeklyGoal / 5));
    setKpiWeeklyGoal(weeklyGoal);
    setKpiBonus(kpiEntry ? Number(kpiEntry.bonus_amount) || 0 : 0);
    setShowKpiSettings(true);
  };

  const openReachOutDialog = (broker) => {
    setReachOutBroker(broker);
    setShowReachOutDialog(true);
  };

  const handleAddBroker = async () => {
    if (!formData.name || !formData.firm) return;

    const { last_contact, ...brokerData } = formData;

    const { data, error } = await supabase
      .from("brokers")
      .insert([brokerData])
      .select()
      .single();

    if (error) {
      console.error("Error adding broker:", error);
    } else {
      setBrokers([data, ...brokers]);
      setShowAddDialog(false);
      setFormData({
        name: "",
        firm: "",
        email: "",
        status: "new",
        last_contact: "",
        next_action: "",
        linkedin_url: "",
        notes: "",
      });
    }
  };

  const handleInlineCreate = async () => {
    if (!inlineCreate.name || !inlineCreate.firm) return;

    const { last_contact, ...brokerData } = inlineCreate;

    const { data, error } = await supabase
      .from("brokers")
      .insert([{ ...brokerData, status: "new" }])
      .select()
      .single();

    if (error) {
      console.error("Error adding broker:", error);
    } else {
      setBrokers([data, ...brokers]);
      setInlineCreate({ name: "", firm: "", email: "", status: "new", last_contact: "", next_action: "", linkedin_url: "" });
      setShowInlineCreate(false);
    }
  };

  const handleUpdateField = async (brokerId, field, value) => {
    const { error } = await supabase
      .from("brokers")
      .update({ [field]: value || null, updated_at: new Date().toISOString() })
      .eq("id", brokerId);

    if (error) {
      console.error("Error updating broker:", error);
    } else {
      setBrokers(brokers.map(b =>
        b.id === brokerId ? { ...b, [field]: value || null } : b
      ));
    }
    setEditingCell(null);
  };

  const handleDeleteBroker = async (brokerId) => {
    if (!confirm("Delete this broker?")) return;

    const { error } = await supabase
      .from("brokers")
      .delete()
      .eq("id", brokerId);

    if (error) {
      console.error("Error deleting broker:", error);
    } else {
      setBrokers(brokers.filter(b => b.id !== brokerId));
    }
  };

  const filteredBrokers = useMemo(() => {
    let filtered = brokers;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - followUpDays);

    switch (activeView) {
      case "need_contact":
        filtered = filtered.filter(b => b.status === "new");
        break;
      case "needs_follow_up":
        filtered = filtered.filter(b =>
          b.status !== "dead" &&
          b.status !== "partnered" &&
          b.status !== "new" &&
          (!b.last_contact || new Date(b.last_contact) < cutoffDate)
        );
        break;
      case "active":
        filtered = filtered.filter(b =>
          ["responded", "call_booked", "call_complete"].includes(b.status)
        );
        break;
      case "partners":
        filtered = filtered.filter(b => b.status === "partnered");
        break;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.name?.toLowerCase().includes(query) ||
        b.firm?.toLowerCase().includes(query) ||
        b.email?.toLowerCase().includes(query)
      );
    }

    filtered = [...filtered].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal?.toLowerCase() || "";
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [brokers, activeView, searchQuery, sortField, sortDirection, followUpDays]);

  const getStatusOption = (status) => STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

  const startEditing = (brokerId, field, currentValue) => {
    setEditingCell({ brokerId, field });
    setEditValue(currentValue || "");
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const saveEditing = () => {
    if (editingCell) {
      handleUpdateField(editingCell.brokerId, editingCell.field, editValue);
    }
  };

  const viewCounts = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - followUpDays);

    return {
      all: brokers.length,
      need_contact: brokers.filter(b => b.status === "new").length,
      needs_follow_up: brokers.filter(b =>
        b.status !== "dead" &&
        b.status !== "partnered" &&
        b.status !== "new" &&
        (!b.last_contact || new Date(b.last_contact) < cutoffDate)
      ).length,
      active: brokers.filter(b =>
        ["responded", "call_booked", "call_complete"].includes(b.status)
      ).length,
      partners: brokers.filter(b => b.status === "partnered").length,
    };
  }, [brokers, followUpDays]);

  const partnerPortalUrl = `${window.location.origin}/partner/signup`;

  const copyPortalLink = () => {
    navigator.clipboard.writeText(partnerPortalUrl);
    alert("Partner portal link copied!");
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Consolidated toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 px-4 h-12">
          <span className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Broker Outreach</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="h-7 w-7 p-0 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100">
                <HelpCircle className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-[13px]">
                  <Info className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  How Partner Outreach Works
                </h4>
                <div className="space-y-2 text-[12px] text-gray-600 dark:text-gray-400">
                  <p><strong>1. Reach Out</strong> — Contact brokers via call, email, or LinkedIn.</p>
                  <p><strong>2. They Sign Up</strong> — Interested brokers sign up at our partner portal.</p>
                  <p><strong>3. Submit Referrals</strong> — Partners log in and submit client referrals.</p>
                  <p><strong>4. Earn Commissions</strong> — When referrals convert, partners earn commissions.</p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-[11px] text-gray-500 mb-2">Partner Sign Up Link</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate">
                      {partnerPortalUrl}
                    </code>
                    <Button variant="outline" className="h-7 px-2" onClick={copyPortalLink}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5 text-[12px] ml-2">
            {VIEWS.map(view => (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`px-2.5 py-1 rounded ${
                  activeView === view.id
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {view.label}
                <span className="opacity-60 ml-1">({viewCounts[view.id]})</span>
              </button>
            ))}
          </div>

          {activeView === "needs_follow_up" && (
            <Select value={followUpDays.toString()} onValueChange={(v) => setFollowUpDays(parseInt(v))}>
              <SelectTrigger className="w-28 h-8 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOLLOW_UP_DAYS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="relative flex-1 max-w-xs min-w-0 ml-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5" />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-[13px] border-gray-200 dark:border-gray-800 focus-visible:ring-1"
            />
          </div>

          <div className="ml-auto">
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Broker
            </Button>
          </div>
        </div>

        {/* KPI metric pills */}
        {kpiStats.length > 0 && (
          <div className="flex items-center gap-5 px-4 h-9 border-t border-gray-100 dark:border-gray-800 overflow-x-auto">
            {kpiStats.map(member => (
              <span
                key={member.id}
                className="text-[13px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5 shrink-0 group cursor-pointer"
                onClick={() => openKpiSettings(member)}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${member.onTrackForBonus ? "bg-green-500" : "bg-gray-400"}`} />
                {member.full_name}
                {member.onTrackForBonus && <Trophy className="w-3 h-3 text-yellow-500" />}
                <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">
                  {member.weekCount}/{member.weeklyGoal}
                </span>
                <span className="text-gray-400 dark:text-gray-500 tabular-nums">
                  · {member.todayCount}/{member.dailyGoal} today
                </span>
                <Settings className="w-3 h-3 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100" />
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                const membersWithoutKpi = teamMembers.filter(tm => !kpiEntries.find(e => e.team_member_id === tm.id));
                if (membersWithoutKpi.length > 0) {
                  openKpiSettings(membersWithoutKpi[0]);
                }
              }}
              className="text-[12px] text-gray-500 hover:text-gray-900 dark:text-gray-100 flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" />
              Set KPI
            </button>
          </div>
        )}

        {kpiStats.length === 0 && teamMembers.length > 0 && (
          <div className="flex items-center gap-3 px-4 h-9 border-t border-gray-100 dark:border-gray-800">
            <span className="text-[13px] text-gray-600 dark:text-gray-400">
              Track daily and weekly reach out goals with bonus incentives.
            </span>
            <Button
              variant="ghost"
              onClick={() => openKpiSettings(teamMembers[0])}
              className="h-7 px-2 text-[13px] ml-auto"
            >
              Configure KPIs
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 min-h-0 bg-white dark:bg-gray-950">
        {loading ? (
          <div className="p-8 text-center text-[13px] text-gray-400 dark:text-gray-500">Loading…</div>
        ) : (
          <>
            <div className="h-7 flex items-center px-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                {VIEWS.find(v => v.id === activeView)?.label || "All"} brokers
              </span>
              <span className="ml-2 text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                {filteredBrokers.length}
              </span>
            </div>

            {filteredBrokers.map(broker => {
              const statusOpt = getStatusOption(broker.status);
              const isEditingName = editingCell?.brokerId === broker.id && editingCell?.field === "name";
              const isEditingFirm = editingCell?.brokerId === broker.id && editingCell?.field === "firm";
              const isEditingEmail = editingCell?.brokerId === broker.id && editingCell?.field === "email";
              const isEditingNext = editingCell?.brokerId === broker.id && editingCell?.field === "next_action";
              const isEditingLinkedIn = editingCell?.brokerId === broker.id && editingCell?.field === "linkedin_url";

              return (
                <div
                  key={broker.id}
                  className="group flex items-center gap-3 px-3 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <div className="w-6 h-6 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex items-center justify-center text-[10px] font-medium">
                    {getInitials(broker.name)}
                  </div>

                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    {isEditingName ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-7 text-[13px]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditing();
                          if (e.key === "Escape") cancelEditing();
                        }}
                        onBlur={saveEditing}
                      />
                    ) : (
                      <span
                        className="text-[13px] text-gray-900 dark:text-gray-100 font-medium truncate cursor-pointer"
                        onClick={() => startEditing(broker.id, "name", broker.name)}
                      >
                        {broker.name || "—"}
                      </span>
                    )}
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusOpt.dot}`} />
                  </div>

                  {isEditingFirm ? (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-7 text-[13px] w-40"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEditing();
                        if (e.key === "Escape") cancelEditing();
                      }}
                      onBlur={saveEditing}
                    />
                  ) : (
                    <span
                      className="hidden md:inline text-[12px] text-gray-500 truncate max-w-[160px] cursor-pointer"
                      onClick={() => startEditing(broker.id, "firm", broker.firm)}
                    >
                      {broker.firm || "—"}
                    </span>
                  )}

                  {isEditingEmail ? (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-7 text-[13px] w-48"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEditing();
                        if (e.key === "Escape") cancelEditing();
                      }}
                      onBlur={saveEditing}
                    />
                  ) : (
                    <span
                      className="hidden lg:inline text-[12px] text-gray-500 truncate max-w-[180px] cursor-pointer"
                      onClick={() => startEditing(broker.id, "email", broker.email)}
                    >
                      {broker.email || "—"}
                    </span>
                  )}

                  <div className="shrink-0 w-28">
                    <Select
                      value={broker.status}
                      onValueChange={(value) => handleUpdateField(broker.id, "status", value)}
                    >
                      <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0 text-[12px] shadow-none focus:ring-0">
                        <SelectValue>
                          <span className={`text-[12px] ${statusOpt.text}`}>
                            {statusOpt.label}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className="flex items-center gap-2 text-[13px]">
                              <span className={`w-1.5 h-1.5 rounded-full ${option.dot}`} />
                              {option.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <span className="hidden xl:inline text-[12px] text-gray-500 tabular-nums w-24 text-right">
                    {broker.last_contact
                      ? new Date(broker.last_contact).toLocaleDateString()
                      : <span className="text-gray-400 dark:text-gray-500">Never</span>}
                  </span>

                  {isEditingNext ? (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-7 text-[13px] w-40"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEditing();
                        if (e.key === "Escape") cancelEditing();
                      }}
                      onBlur={saveEditing}
                    />
                  ) : (
                    <span
                      className="hidden xl:inline text-[12px] text-gray-500 truncate max-w-[140px] cursor-pointer"
                      onClick={() => startEditing(broker.id, "next_action", broker.next_action)}
                    >
                      {broker.next_action || "—"}
                    </span>
                  )}

                  {isEditingLinkedIn ? (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-7 text-[13px] w-48"
                      placeholder="https://linkedin.com/in/..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEditing();
                        if (e.key === "Escape") cancelEditing();
                      }}
                      onBlur={saveEditing}
                    />
                  ) : broker.linkedin_url ? (
                    <a
                      href={broker.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:text-gray-400 text-[12px] shrink-0"
                      onClick={() => startEditing(broker.id, "linkedin_url", "")}
                    >
                      —
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openReachOutDialog(broker)}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 h-6 rounded border border-gray-200 dark:border-gray-800 text-[12px] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100 hover:bg-white dark:bg-gray-950"
                  >
                    <TrendingUp className="w-3 h-3" />
                    Log
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteBroker(broker.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Inline create row */}
            {showInlineCreate ? (
              <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <div className="w-6 h-6 shrink-0" />
                <Input
                  placeholder="Name *"
                  value={inlineCreate.name}
                  onChange={(e) => setInlineCreate({ ...inlineCreate, name: e.target.value })}
                  className="h-7 text-[13px] flex-1 max-w-[180px]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInlineCreate();
                    if (e.key === "Escape") setShowInlineCreate(false);
                  }}
                />
                <Input
                  placeholder="Firm *"
                  value={inlineCreate.firm}
                  onChange={(e) => setInlineCreate({ ...inlineCreate, firm: e.target.value })}
                  className="h-7 text-[13px] w-40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInlineCreate();
                    if (e.key === "Escape") setShowInlineCreate(false);
                  }}
                />
                <Input
                  placeholder="Email"
                  value={inlineCreate.email}
                  onChange={(e) => setInlineCreate({ ...inlineCreate, email: e.target.value })}
                  className="h-7 text-[13px] w-48"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInlineCreate();
                    if (e.key === "Escape") setShowInlineCreate(false);
                  }}
                />
                <Input
                  placeholder="Next action"
                  value={inlineCreate.next_action}
                  onChange={(e) => setInlineCreate({ ...inlineCreate, next_action: e.target.value })}
                  className="h-7 text-[13px] w-40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInlineCreate();
                    if (e.key === "Escape") setShowInlineCreate(false);
                  }}
                />
                <button
                  type="button"
                  onClick={handleInlineCreate}
                  disabled={!inlineCreate.name || !inlineCreate.firm}
                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100 disabled:opacity-40"
                >
                  <Check className={`w-3.5 h-3.5 ${inlineCreate.name && inlineCreate.firm ? 'text-green-600' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowInlineCreate(false)}
                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowInlineCreate(true)}
                className="w-full flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-[13px] text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <Plus className="w-3.5 h-3.5" />
                Add broker
              </button>
            )}
          </>
        )}
      </div>

      {/* Log Reach Out Dialog */}
      <Dialog open={showReachOutDialog} onOpenChange={setShowReachOutDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Reach Out</DialogTitle>
          </DialogHeader>
          {reachOutBroker && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className="font-medium text-[13px]">{reachOutBroker.name}</p>
                <p className="text-[12px] text-gray-500">{reachOutBroker.firm}</p>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex gap-2">
                  {REACH_OUT_TYPES.map(type => (
                    <Button
                      key={type.value}
                      variant={reachOutType === type.value ? "default" : "outline"}
                      className={reachOutType === type.value ? "bg-gray-900 hover:bg-gray-800 text-white h-8" : "h-8"}
                      onClick={() => setReachOutType(type.value)}
                    >
                      <type.icon className="w-4 h-4 mr-1" />
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reached out by *</Label>
                <Select value={reachOutBy} onValueChange={setReachOutBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={reachOutNote}
                  onChange={(e) => setReachOutNote(e.target.value)}
                  placeholder="Any notes about this reach out..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReachOutDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLogReachOut}
              disabled={!reachOutBy || savingReachOut}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              {savingReachOut ? "Saving..." : "Log Reach Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI Settings Sheet */}
      <FormShell
        open={showKpiSettings}
        onOpenChange={setShowKpiSettings}
        storageKey="hdo.brokerForm.viewMode"
        title="Set KPI Goals"
        description="Configure weekly reach out goals and bonus incentives"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Team Member</Label>
            <Select value={kpiMember?.id || ""} onValueChange={(id) => {
              const member = teamMembers.find(m => m.id === id);
              if (member) {
                setKpiMember(member);
                const entry = kpiEntries.find(e => e.team_member_id === id);
                const wg = entry ? Number(entry.target_value) || 0 : 0;
                setKpiDailyGoal(Math.ceil(wg / 5));
                setKpiWeeklyGoal(wg);
                setKpiBonus(entry ? Number(entry.bonus_amount) || 0 : 0);
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Weekly Goal (reach outs per week)</Label>
            <Input
              type="number"
              value={kpiWeeklyGoal}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setKpiWeeklyGoal(val);
                setKpiDailyGoal(Math.ceil(val / 5));
              }}
              placeholder="e.g., 25"
            />
            <p className="text-xs text-gray-500">
              Daily target: {kpiWeeklyGoal > 0 ? Math.ceil(kpiWeeklyGoal / 5) : 0} per day (weekly / 5)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Bonus Amount ($)</Label>
            <Input
              type="number"
              value={kpiBonus}
              onChange={(e) => setKpiBonus(parseFloat(e.target.value) || 0)}
              placeholder="e.g., 50"
            />
            <p className="text-xs text-gray-500">Bonus earned when weekly goal is met</p>
          </div>

          <Button
            className="w-full bg-gray-900 hover:bg-gray-800 text-white"
            onClick={handleSaveKpi}
            disabled={!kpiMember}
          >
            Save KPI Settings
          </Button>
        </div>
      </FormShell>

      {/* Add Broker Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Broker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label>Firm *</Label>
                <Input
                  value={formData.firm}
                  onChange={(e) => setFormData({ ...formData, firm: e.target.value })}
                  placeholder="Acme Brokerage"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>LinkedIn URL</Label>
              <Input
                value={formData.linkedin_url}
                onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Next Action</Label>
              <Input
                value={formData.next_action}
                onChange={(e) => setFormData({ ...formData, next_action: e.target.value })}
                placeholder="Send follow-up email"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddBroker}
              disabled={!formData.name || !formData.firm}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              Add Broker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
