import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  Trash2,
  ExternalLink,
  ArrowUpDown,
  Check,
  X,
  PhoneCall,
  Mail,
  Linkedin,
  Target,
  Trophy,
  TrendingUp,
  Settings,
  MessageSquare,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-gray-100 text-gray-700" },
  { value: "contacted", label: "Contacted", color: "bg-blue-100 text-blue-700" },
  { value: "responded", label: "Responded", color: "bg-purple-100 text-purple-700" },
  { value: "call_booked", label: "Call Booked", color: "bg-yellow-100 text-yellow-700" },
  { value: "call_complete", label: "Call Complete", color: "bg-indigo-100 text-indigo-700" },
  { value: "signed_up", label: "Signed Up", color: "bg-cyan-100 text-cyan-700" },
  { value: "partnered", label: "Partnered", color: "bg-green-100 text-green-700" },
  { value: "dead", label: "Dead", color: "bg-red-100 text-red-700" },
];

const REACH_OUT_TYPES = [
  { value: "call", label: "Call", icon: PhoneCall, color: "text-green-600", bg: "bg-green-100" },
  { value: "email", label: "Email", icon: Mail, color: "text-blue-600", bg: "bg-blue-100" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-indigo-600", bg: "bg-indigo-100" },
  { value: "meeting", label: "Meeting", icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-100" },
];

const VIEWS = [
  { id: "all", label: "All Brokers" },
  { id: "need_contact", label: "Need to Contact" },
  { id: "waiting", label: "Waiting on Response" },
  { id: "active", label: "Active Pipeline" },
  { id: "partners", label: "Partners" },
];

export default function BrokerOutreach() {
  const { user } = useAuth();
  const [brokers, setBrokers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState("all");
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
    const [brokersRes, teamRes, activitiesRes] = await Promise.all([
      supabase.from("brokers").select("*").order("created_at", { ascending: false }),
      supabase.from("team_members").select("*").eq("status", "active"),
      supabase.from("broker_activities").select("*, team_members(full_name)").order("created_at", { ascending: false }),
    ]);

    setBrokers(brokersRes.data || []);
    setTeamMembers(teamRes.data || []);
    setActivities(activitiesRes.data || []);
    setLoading(false);
  };

  // Calculate KPI stats for each team member
  const kpiStats = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    return teamMembers
      .filter(tm => tm.outreach_daily_goal > 0 || tm.outreach_weekly_goal > 0)
      .map(member => {
        const memberActivities = activities.filter(a => a.team_member_id === member.id);
        const todayCount = memberActivities.filter(a => new Date(a.created_at) >= startOfDay).length;
        const weekCount = memberActivities.filter(a => new Date(a.created_at) >= startOfWeek).length;

        const dailyProgress = member.outreach_daily_goal > 0 ? (todayCount / member.outreach_daily_goal) * 100 : 0;
        const weeklyProgress = member.outreach_weekly_goal > 0 ? (weekCount / member.outreach_weekly_goal) * 100 : 0;
        const onTrackForBonus = weeklyProgress >= 100 || (dailyProgress >= 100 && weeklyProgress >= (today.getDay() / 7) * 100);

        return {
          ...member,
          todayCount,
          weekCount,
          dailyProgress: Math.min(dailyProgress, 100),
          weeklyProgress: Math.min(weeklyProgress, 100),
          onTrackForBonus,
        };
      });
  }, [teamMembers, activities]);

  const handleLogReachOut = async () => {
    if (!reachOutBroker || !reachOutBy) return;

    setSavingReachOut(true);
    try {
      // Create activity record
      await supabase.from("broker_activities").insert({
        broker_id: reachOutBroker.id,
        team_member_id: reachOutBy,
        type: reachOutType,
        description: reachOutNote,
      });

      // Update broker's last_contact and status
      const updates = {
        last_contact: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      };
      if (reachOutBroker.status === "new") {
        updates.status = "contacted";
      }
      await supabase.from("brokers").update(updates).eq("id", reachOutBroker.id);

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

    await supabase.from("team_members").update({
      outreach_daily_goal: kpiDailyGoal,
      outreach_weekly_goal: kpiWeeklyGoal,
      outreach_bonus_amount: kpiBonus,
    }).eq("id", kpiMember.id);

    setShowKpiSettings(false);
    setKpiMember(null);
    loadData();
  };

  const openKpiSettings = (member) => {
    setKpiMember(member);
    setKpiDailyGoal(member.outreach_daily_goal || 0);
    setKpiWeeklyGoal(member.outreach_weekly_goal || 0);
    setKpiBonus(member.outreach_bonus_amount || 0);
    setShowKpiSettings(true);
  };

  const openReachOutDialog = (broker) => {
    setReachOutBroker(broker);
    setShowReachOutDialog(true);
  };

  const handleAddBroker = async () => {
    if (!formData.name || !formData.firm) return;

    const { data, error } = await supabase
      .from("brokers")
      .insert([formData])
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

    const { data, error } = await supabase
      .from("brokers")
      .insert([{ ...inlineCreate, status: "new" }])
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredBrokers = useMemo(() => {
    let filtered = brokers;

    const today = new Date();
    const fiveDaysAgo = new Date(today.setDate(today.getDate() - 5));

    switch (activeView) {
      case "need_contact":
        filtered = filtered.filter(b => b.status === "new");
        break;
      case "waiting":
        filtered = filtered.filter(b =>
          b.status === "contacted" &&
          b.last_contact &&
          new Date(b.last_contact) < fiveDaysAgo
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
  }, [brokers, activeView, searchQuery, sortField, sortDirection]);

  const getStatusBadge = (status) => {
    const option = STATUS_OPTIONS.find(s => s.value === status);
    return option ? (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${option.color}`}>
        {option.label}
      </span>
    ) : null;
  };

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

  const SortableHeader = ({ field, children }) => (
    <TableHead
      className="cursor-pointer hover:bg-gray-50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3 text-gray-400" />
      </div>
    </TableHead>
  );

  const EditableCell = ({ broker, field, type = "text" }) => {
    const isEditing = editingCell?.brokerId === broker.id && editingCell?.field === field;
    const value = broker[field];

    if (isEditing) {
      return (
        <TableCell className="p-1">
          <Input
            type={type === "date" ? "date" : "text"}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEditing();
              if (e.key === "Escape") cancelEditing();
            }}
            onBlur={saveEditing}
          />
        </TableCell>
      );
    }

    return (
      <TableCell
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => startEditing(broker.id, field, value)}
      >
        {type === "date" && value ? new Date(value).toLocaleDateString() : value || "—"}
      </TableCell>
    );
  };

  const viewCounts = useMemo(() => {
    const today = new Date();
    const fiveDaysAgo = new Date(new Date().setDate(today.getDate() - 5));

    return {
      all: brokers.length,
      need_contact: brokers.filter(b => b.status === "new").length,
      waiting: brokers.filter(b =>
        b.status === "contacted" &&
        b.last_contact &&
        new Date(b.last_contact) < fiveDaysAgo
      ).length,
      active: brokers.filter(b =>
        ["responded", "call_booked", "call_complete"].includes(b.status)
      ).length,
      partners: brokers.filter(b => b.status === "partnered").length,
    };
  }, [brokers]);

  // Get recent activities for a broker
  const getBrokerActivities = (brokerId) => {
    return activities.filter(a => a.broker_id === brokerId).slice(0, 3);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broker Outreach</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage broker relationships</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Broker
        </Button>
      </div>

      {/* KPI Dashboard */}
      {kpiStats.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              Team KPIs
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kpiStats.map(member => (
              <Card key={member.id} className={`${member.onTrackForBonus ? 'border-green-300 bg-green-50/50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{member.full_name}</span>
                      {member.onTrackForBonus && (
                        <Trophy className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openKpiSettings(member)}>
                      <Settings className="w-3 h-3 text-gray-400" />
                    </Button>
                  </div>

                  {/* Daily Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Today</span>
                      <span className="font-medium">{member.todayCount} / {member.outreach_daily_goal}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${member.dailyProgress >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                        style={{ width: `${member.dailyProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Weekly Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">This Week</span>
                      <span className="font-medium">{member.weekCount} / {member.outreach_weekly_goal}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${member.weeklyProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${member.weeklyProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Bonus Info */}
                  {member.outreach_bonus_amount > 0 && (
                    <div className={`text-xs px-2 py-1 rounded-full text-center ${member.onTrackForBonus ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {member.onTrackForBonus ? '✓ On track for' : 'Goal:'} ${member.outreach_bonus_amount} bonus
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Add KPI Card */}
            <Card className="border-dashed border-2 border-gray-200 hover:border-gray-300 cursor-pointer" onClick={() => {
              const membersWithoutKpi = teamMembers.filter(tm => !tm.outreach_daily_goal && !tm.outreach_weekly_goal);
              if (membersWithoutKpi.length > 0) {
                openKpiSettings(membersWithoutKpi[0]);
              }
            }}>
              <CardContent className="p-4 flex items-center justify-center h-full min-h-[140px]">
                <div className="text-center text-gray-400">
                  <Plus className="w-6 h-6 mx-auto mb-1" />
                  <span className="text-sm">Set Team KPIs</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Show setup prompt if no KPIs */}
      {kpiStats.length === 0 && teamMembers.length > 0 && (
        <Card className="mb-6 bg-indigo-50 border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-indigo-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Set Up Team KPIs</h3>
                  <p className="text-sm text-gray-600">Track daily and weekly reach out goals with bonus incentives</p>
                </div>
              </div>
              <Button onClick={() => openKpiSettings(teamMembers[0])}>
                Configure
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Views */}
      <div className="flex gap-2 mb-4 border-b">
        {VIEWS.map(view => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeView === view.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {view.label}
            <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {viewCounts[view.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, firm, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="name">Name</SortableHeader>
              <SortableHeader field="firm">Firm</SortableHeader>
              <SortableHeader field="email">Email</SortableHeader>
              <SortableHeader field="status">Status</SortableHeader>
              <SortableHeader field="last_contact">Last Contact</SortableHeader>
              <TableHead>Next Action</TableHead>
              <TableHead>LinkedIn</TableHead>
              <TableHead>Reach Out</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              filteredBrokers.map(broker => (
                <TableRow key={broker.id} className="group">
                  <EditableCell broker={broker} field="name" />
                  <EditableCell broker={broker} field="firm" />
                  <EditableCell broker={broker} field="email" />
                  <TableCell>
                    <Select
                      value={broker.status}
                      onValueChange={(value) => handleUpdateField(broker.id, "status", value)}
                    >
                      <SelectTrigger className="h-8 w-36 border-0 bg-transparent p-0">
                        <SelectValue>{getStatusBadge(broker.status)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${option.color}`}>
                              {option.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <EditableCell broker={broker} field="last_contact" type="date" />
                  <EditableCell broker={broker} field="next_action" />
                  <TableCell>
                    {editingCell?.brokerId === broker.id && editingCell?.field === "linkedin_url" ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8 text-sm"
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
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <span
                        className="text-gray-400 cursor-pointer hover:text-gray-600"
                        onClick={() => startEditing(broker.id, "linkedin_url", "")}
                      >
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => openReachOutDialog(broker)}
                    >
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Log
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteBroker(broker.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}

            {/* Inline Create Row */}
            {showInlineCreate ? (
              <TableRow className="bg-gray-50/50 border-t">
                <TableCell className="p-1">
                  <Input
                    placeholder="Name *"
                    value={inlineCreate.name}
                    onChange={(e) => setInlineCreate({ ...inlineCreate, name: e.target.value })}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleInlineCreate();
                      if (e.key === "Escape") setShowInlineCreate(false);
                    }}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    placeholder="Firm *"
                    value={inlineCreate.firm}
                    onChange={(e) => setInlineCreate({ ...inlineCreate, firm: e.target.value })}
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleInlineCreate();
                      if (e.key === "Escape") setShowInlineCreate(false);
                    }}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    placeholder="Email"
                    value={inlineCreate.email}
                    onChange={(e) => setInlineCreate({ ...inlineCreate, email: e.target.value })}
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleInlineCreate();
                      if (e.key === "Escape") setShowInlineCreate(false);
                    }}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Select
                    value={inlineCreate.status}
                    onValueChange={(value) => setInlineCreate({ ...inlineCreate, status: value })}
                  >
                    <SelectTrigger className="h-8 w-32 text-sm">
                      <SelectValue>{getStatusBadge(inlineCreate.status)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${option.color}`}>
                            {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    type="date"
                    value={inlineCreate.last_contact}
                    onChange={(e) => setInlineCreate({ ...inlineCreate, last_contact: e.target.value })}
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleInlineCreate();
                      if (e.key === "Escape") setShowInlineCreate(false);
                    }}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    placeholder="Next action"
                    value={inlineCreate.next_action}
                    onChange={(e) => setInlineCreate({ ...inlineCreate, next_action: e.target.value })}
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleInlineCreate();
                      if (e.key === "Escape") setShowInlineCreate(false);
                    }}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    placeholder="LinkedIn"
                    value={inlineCreate.linkedin_url}
                    onChange={(e) => setInlineCreate({ ...inlineCreate, linkedin_url: e.target.value })}
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleInlineCreate();
                      if (e.key === "Escape") setShowInlineCreate(false);
                    }}
                  />
                </TableCell>
                <TableCell></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={handleInlineCreate}
                      disabled={!inlineCreate.name || !inlineCreate.firm}
                    >
                      <Check className={`w-4 h-4 ${inlineCreate.name && inlineCreate.firm ? 'text-green-600' : 'text-gray-300'}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => setShowInlineCreate(false)}
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow
                className="hover:bg-gray-50 cursor-pointer border-t"
                onClick={() => setShowInlineCreate(true)}
              >
                <TableCell className="py-3">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Plus className="w-4 h-4" />
                  </div>
                </TableCell>
                <TableCell colSpan={8}></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Log Reach Out Dialog */}
      <Dialog open={showReachOutDialog} onOpenChange={setShowReachOutDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Reach Out</DialogTitle>
          </DialogHeader>
          {reachOutBroker && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium">{reachOutBroker.name}</p>
                <p className="text-sm text-gray-500">{reachOutBroker.firm}</p>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex gap-2">
                  {REACH_OUT_TYPES.map(type => (
                    <Button
                      key={type.value}
                      variant={reachOutType === type.value ? "default" : "outline"}
                      size="sm"
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
            <Button onClick={handleLogReachOut} disabled={!reachOutBy || savingReachOut}>
              {savingReachOut ? "Saving..." : "Log Reach Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI Settings Sheet */}
      <Sheet open={showKpiSettings} onOpenChange={setShowKpiSettings}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Set KPI Goals</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select value={kpiMember?.id || ""} onValueChange={(id) => {
                const member = teamMembers.find(m => m.id === id);
                if (member) {
                  setKpiMember(member);
                  setKpiDailyGoal(member.outreach_daily_goal || 0);
                  setKpiWeeklyGoal(member.outreach_weekly_goal || 0);
                  setKpiBonus(member.outreach_bonus_amount || 0);
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
              <Label>Daily Goal (reach outs per day)</Label>
              <Input
                type="number"
                value={kpiDailyGoal}
                onChange={(e) => setKpiDailyGoal(parseInt(e.target.value) || 0)}
                placeholder="e.g., 5"
              />
            </div>

            <div className="space-y-2">
              <Label>Weekly Goal (reach outs per week)</Label>
              <Input
                type="number"
                value={kpiWeeklyGoal}
                onChange={(e) => setKpiWeeklyGoal(parseInt(e.target.value) || 0)}
                placeholder="e.g., 25"
              />
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

            <Button className="w-full" onClick={handleSaveKpi} disabled={!kpiMember}>
              Save KPI Settings
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
            <div className="grid grid-cols-2 gap-4">
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
                <Label>Last Contact</Label>
                <Input
                  type="date"
                  value={formData.last_contact}
                  onChange={(e) => setFormData({ ...formData, last_contact: e.target.value })}
                />
              </div>
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
            <Button onClick={handleAddBroker} disabled={!formData.name || !formData.firm}>
              Add Broker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
