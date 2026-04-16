import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { Lead, TeamMember } from "@/api/entities";
import { sendNotification } from "@/api/functions";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Building2,
  User,
  Search,
  Filter,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Flame,
  Thermometer,
  Snowflake,
  Users,
  Mail,
  PhoneCall,
  CalendarPlus,
  MessageSquare,
  Trash2,
  Calendar,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import LeadForm from "../components/crm/LeadForm";
import FormShell from "@/components/ui/FormShell";

const PRIORITY_OPTIONS = [
  { value: "hot", label: "Hot", icon: Flame, color: "text-red-500" },
  { value: "warm", label: "Warm", icon: Thermometer, color: "text-orange-500" },
  { value: "cold", label: "Cold", icon: Snowflake, color: "text-blue-500" },
];

const ACTIVITY_TYPES = [
  { value: "call", label: "Call", icon: PhoneCall, color: "text-green-600", bg: "bg-green-100" },
  { value: "email", label: "Email", icon: Mail, color: "text-blue-600", bg: "bg-blue-100" },
  { value: "meeting", label: "Meeting", icon: CalendarPlus, color: "text-purple-600", bg: "bg-purple-100" },
  { value: "note", label: "Note", icon: MessageSquare, color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-800" },
];

export default function CRM() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [viewMode, setViewMode] = useState("kanban");
  const [collapsedColumns, setCollapsedColumns] = useState({ won: false, lost: false });
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ source: "all", assignedTo: "all", priority: "all" });

  // Lead detail sheet
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLeadDetail, setShowLeadDetail] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Activity form
  const [activityType, setActivityType] = useState("note");
  const [activityDescription, setActivityDescription] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);

  // Lead form
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState({ open: false, leadId: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [leadsData, teamMembersData] = await Promise.all([
        Lead.list("-created_at"),
        TeamMember.list()
      ]);
      setLeads(leadsData);
      setTeamMembers(teamMembersData);
    } catch (error) {
      console.error("Error loading CRM data:", error);
    }
  };

  const loadActivities = async (leadId) => {
    setLoadingActivities(true);
    const { data } = await supabase
      .from("lead_activities")
      .select("*, user_profiles(full_name)")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setActivities(data || []);
    setLoadingActivities(false);
  };

  const handleOpenLeadDetail = async (lead) => {
    setSelectedLead(lead);
    setShowLeadDetail(true);
    await loadActivities(lead.id);
  };

  const handleSubmitLead = async (leadData) => {
    if (editingLead) {
      await Lead.update(editingLead.id, leadData);
    } else {
      await Lead.create(leadData);
    }
    setShowLeadForm(false);
    setEditingLead(null);
    loadData();
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const lead = leads.find(l => l.id === draggableId);
    if (lead && source.droppableId !== destination.droppableId) {
      await Lead.update(lead.id, { status: destination.droppableId });

      // Auto-approve referral when lead is marked as won
      if (destination.droppableId === "won" && lead.referral_id) {
        const { error: refError } = await supabase.from("referrals").update({ status: "active" }).eq("id", lead.referral_id);
        if (refError) console.error("Error approving referral:", refError);
      }

      loadData();
    }
  };

  const handleDelete = async () => {
    if (deleteDialog.leadId) {
      await Lead.delete(deleteDialog.leadId);
      setDeleteDialog({ open: false, leadId: null });
      setShowLeadDetail(false);
      setSelectedLead(null);
      loadData();
    }
  };

  const handleLogActivity = async () => {
    if (!selectedLead || !activityDescription.trim()) return;

    setSavingActivity(true);
    try {
      // Save activity
      const { error: actError } = await supabase.from("lead_activities").insert({
        lead_id: selectedLead.id,
        type: activityType,
        description: activityDescription,
        created_by: user?.id,
      });
      if (actError) throw actError;

      // Update lead's last contact if it's a call or email
      if (activityType === "call" || activityType === "email") {
        await Lead.update(selectedLead.id, {
          ...selectedLead,
          last_contact: new Date().toISOString().split("T")[0],
        });
      }

      // Create notification for team
      const { data: admins } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("role", "admin");

      if (admins?.length) {
        const activityLabel = ACTIVITY_TYPES.find(a => a.value === activityType)?.label || activityType;
        await Promise.all(
          admins
            .filter(a => a.id !== user?.id)
            .map((admin) =>
              sendNotification({
                userId: admin.id,
                type: "info",
                category: "crm",
                priority: "normal",
                source: "crm.activity_logged",
                title: `${activityLabel} logged`,
                message: `${activityLabel} logged for ${selectedLead.company_name}: ${activityDescription.substring(0, 50)}${activityDescription.length > 50 ? "..." : ""}`,
                link: "/CRM",
              })
            )
        );
      }

      setActivityDescription("");
      setActivityType("note");
      await loadActivities(selectedLead.id);
      loadData();
    } catch (error) {
      console.error("Error logging activity:", error);
    } finally {
      setSavingActivity(false);
    }
  };

  const handleUpdatePriority = async (lead, priority) => {
    await Lead.update(lead.id, { priority });
    if (selectedLead?.id === lead.id) {
      setSelectedLead({ ...lead, priority });
    }
    loadData();
  };

  const columns = [
    { id: "new", label: "New", color: "bg-purple-500" },
    { id: "contacted", label: "Contacted", color: "bg-blue-500" },
    { id: "qualified", label: "Qualified", color: "bg-indigo-500" },
    { id: "proposal", label: "Proposal", color: "bg-yellow-500" },
    { id: "negotiation", label: "Negotiation", color: "bg-orange-500" },
    { id: "won", label: "Won", color: "bg-green-500" },
    { id: "lost", label: "Lost", color: "bg-red-500" },
  ];

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!lead.company_name?.toLowerCase().includes(query) &&
            !lead.contact_name?.toLowerCase().includes(query) &&
            !lead.email?.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (filters.source && filters.source !== "all" && lead.source !== filters.source) return false;
      if (filters.assignedTo && filters.assignedTo !== "all" && lead.assigned_to !== filters.assignedTo) return false;
      if (filters.priority && filters.priority !== "all" && lead.priority !== filters.priority) return false;
      return true;
    });
  }, [leads, searchQuery, filters]);

  const getLeadsByStatus = (status) => filteredLeads.filter(lead => lead.status === status);

  const stats = useMemo(() => {
    const activeLeads = leads.filter(l => l.status !== "lost" && l.status !== "won");
    const pipelineValue = activeLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
    const wonValue = leads.filter(l => l.status === "won").reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
    const closedDeals = leads.filter(l => l.status === "won" || l.status === "lost").length;
    const conversionRate = closedDeals > 0 ? ((leads.filter(l => l.status === "won").length / closedDeals) * 100) : 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const staleLeads = activeLeads.filter(l => new Date(l.updated_at || l.created_at) < sevenDaysAgo).length;

    return { pipelineValue, wonValue, activeLeads: activeLeads.length, conversionRate, staleLeads };
  }, [leads]);

  const getStageAge = (lead) => {
    const updated = new Date(lead.updated_at || lead.created_at);
    return Math.floor((new Date() - updated) / (1000 * 60 * 60 * 24));
  };

  const isStale = (lead) => {
    if (lead.status === "won" || lead.status === "lost") return false;
    return getStageAge(lead) >= 7;
  };

  const isPartnerReferral = (lead) => lead.referral_id || lead.source?.toLowerCase().includes("partner");

  const toggleColumn = (columnId) => setCollapsedColumns(prev => ({ ...prev, [columnId]: !prev[columnId] }));

  const activeFilterCount =
    (filters.source !== "all" ? 1 : 0) +
    (filters.assignedTo !== "all" ? 1 : 0) +
    (filters.priority !== "all" ? 1 : 0);

  // Dense kanban card
  const LeadCard = ({ lead, isDragging }) => {
    const stale = isStale(lead);
    const partnerReferral = isPartnerReferral(lead);
    const priority = PRIORITY_OPTIONS.find(p => p.value === lead.priority);
    const PriorityIcon = priority?.icon;

    return (
      <div
        onClick={() => handleOpenLeadDetail(lead)}
        className={`cursor-pointer bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded p-2 hover:border-gray-300 dark:border-gray-700 transition-colors
          ${stale ? "border-amber-300 bg-amber-50/30" : ""}
          ${isDragging ? "ring-1 ring-indigo-400" : ""}
        `}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {PriorityIcon && <PriorityIcon className={`w-3 h-3 flex-shrink-0 ${priority.color}`} />}
            <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium truncate">{lead.company_name}</span>
          </div>
          {lead.estimated_value > 0 && (
            <span className="text-[11px] text-gray-900 dark:text-gray-100 font-medium tabular-nums flex-shrink-0">
              ${(lead.estimated_value / 1000).toFixed(0)}k
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-500">
          <User className="w-3 h-3" />
          <span className="truncate">{lead.contact_name}</span>
        </div>
        {(partnerReferral || stale || lead.next_action_date) && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {partnerReferral && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-600">
                <Users className="w-2.5 h-2.5" />
                Partner
              </span>
            )}
            {stale && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
                <AlertCircle className="w-2.5 h-2.5" />
                {getStageAge(lead)}d
              </span>
            )}
            {lead.next_action_date && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                <Calendar className="w-2.5 h-2.5" />
                {new Date(lead.next_action_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // Dense list row
  const ListRow = ({ lead }) => {
    const stale = isStale(lead);
    const column = columns.find(c => c.id === lead.status);
    const priority = PRIORITY_OPTIONS.find(p => p.value === lead.priority);
    const PriorityIcon = priority?.icon;
    const initials = (lead.company_name || "?")
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

    return (
      <div
        onClick={() => handleOpenLeadDetail(lead)}
        className={`group flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer ${stale ? "bg-amber-50/30" : ""}`}
      >
        <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 dark:text-gray-300 flex items-center justify-center text-[10px] font-medium flex-shrink-0">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {PriorityIcon && <PriorityIcon className={`w-3 h-3 flex-shrink-0 ${priority.color}`} />}
            <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium truncate">{lead.company_name}</span>
            {lead.contact_name && (
              <span className="text-gray-400 dark:text-gray-500 text-[12px] ml-1 truncate">· {lead.contact_name}</span>
            )}
          </div>
        </div>

        <span className="hidden md:inline text-[12px] text-gray-500 w-48 truncate text-right">
          {lead.email || "—"}
        </span>

        <span className="inline-flex items-center gap-1.5 w-24 justify-end">
          {column && <span className={`w-1.5 h-1.5 rounded-full ${column.color}`} />}
          <span className="text-[11px] text-gray-500">{column?.label || lead.status}</span>
        </span>

        <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium w-20 text-right tabular-nums">
          {lead.estimated_value ? `$${lead.estimated_value.toLocaleString()}` : "—"}
        </span>

        <span className="hidden md:inline text-[12px] text-gray-500 w-24 text-right">
          {lead.next_action_date ? new Date(lead.next_action_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
        </span>

        {stale && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600 w-10 justify-end">
            <AlertCircle className="w-3 h-3" />
            {getStageAge(lead)}d
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Page header with inline metric strip */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Sales Pipeline</h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-gray-600 dark:text-gray-400">
            <span>Pipeline <span className="text-gray-900 dark:text-gray-100 font-medium">${stats.pipelineValue.toLocaleString()}</span></span>
            <span>Won <span className="text-gray-900 dark:text-gray-100 font-medium">${stats.wonValue.toLocaleString()}</span></span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Active <span className="text-gray-900 dark:text-gray-100 font-medium">{stats.activeLeads}</span>
            </span>
            {stats.staleLeads > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Stale <span className="text-amber-600 font-medium">{stats.staleLeads}</span>
              </span>
            )}
            <span>Win rate <span className="text-gray-900 dark:text-gray-100 font-medium">{stats.conversionRate.toFixed(0)}%</span></span>
          </div>
        </div>
      </div>

      {/* Consolidated toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 px-4 h-12">
          <div className="relative flex-1 max-w-md min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5" />
            <Input
              placeholder="Search leads"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-[13px] border-gray-200 dark:border-gray-800 focus-visible:ring-1"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5 h-8 text-[13px]">
                <Filter className="w-3.5 h-3.5" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Filters</span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                    onClick={() => setFilters({ source: "all", assignedTo: "all", priority: "all" })}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Source</label>
                <Select value={filters.source} onValueChange={(value) => setFilters({ ...filters, source: value })}>
                  <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Priority</label>
                <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    {PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Assignee</label>
                <Select value={filters.assignedTo} onValueChange={(value) => setFilters({ ...filters, assignedTo: value })}>
                  <SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team</SelectItem>
                    {teamMembers.map(tm => (
                      <SelectItem key={tm.id} value={tm.id}>{tm.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`p-1 rounded ${viewMode === "kanban" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                title="Kanban"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-1 rounded ${viewMode === "list" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                title="List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
            <Button
              onClick={() => { setEditingLead(null); setShowLeadForm(true); }}
              size="sm"
              className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Lead
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {viewMode === "kanban" ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="h-full overflow-x-auto">
              <div className="inline-flex h-full gap-3 p-4 min-w-full">
                {columns.map((column) => {
                  const columnLeads = getLeadsByStatus(column.id);
                  const columnValue = columnLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
                  const isCollapsed = collapsedColumns[column.id];
                  const canCollapse = column.id === "won" || column.id === "lost";

                  if (isCollapsed) {
                    return (
                      <div key={column.id} className="flex-shrink-0 w-10 cursor-pointer" onClick={() => toggleColumn(column.id)}>
                        <div className="h-full border border-gray-200 dark:border-gray-800 rounded flex flex-col items-center py-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800">
                          <div className={`w-2 h-2 rounded-full ${column.color} mb-2`} />
                          <span className="text-[11px] text-gray-600 dark:text-gray-400" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                            {column.label} ({columnLeads.length})
                          </span>
                          <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-500 mt-2" />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={column.id} className="flex-shrink-0 w-64 flex flex-col">
                      <div className="flex items-center justify-between px-1 pb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-2 h-2 rounded-full ${column.color}`} />
                          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-700 dark:text-gray-300 truncate">
                            {column.label}
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{columnLeads.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {columnValue > 0 && (
                            <span className="text-[11px] text-gray-500 tabular-nums">
                              ${(columnValue / 1000).toFixed(0)}k
                            </span>
                          )}
                          {canCollapse && (
                            <button
                              type="button"
                              onClick={() => toggleColumn(column.id)}
                              className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <Droppable droppableId={column.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 rounded transition-colors ${snapshot.isDraggingOver ? "bg-gray-100 dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-900"} p-1.5 overflow-y-auto`}
                          >
                            <div className="space-y-1.5">
                              {columnLeads.map((lead, index) => (
                                <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                      <LeadCard lead={lead} isDragging={snapshot.isDragging} />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                              {columnLeads.length === 0 && (
                                <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                                  <Building2 className="w-5 h-5 mx-auto mb-1 opacity-50" />
                                  <p className="text-[11px]">No leads</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </div>
          </DragDropContext>
        ) : (
          <div className="overflow-y-auto h-full bg-white dark:bg-gray-950">
            {filteredLeads.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                {leads.length === 0 ? 'No leads yet. Click "New Lead" to get started.' : "No leads match your filters."}
              </div>
            ) : (
              filteredLeads.map(lead => <ListRow key={lead.id} lead={lead} />)
            )}
          </div>
        )}
      </div>

      {/* Lead Detail Sheet */}
      <Sheet open={showLeadDetail} onOpenChange={setShowLeadDetail}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="text-[15px] font-semibold">{selectedLead.company_name}</SheetTitle>
                    <p className="text-[13px] text-gray-500 mt-0.5">{selectedLead.contact_name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[13px]">
                          {(() => {
                            const p = PRIORITY_OPTIONS.find(p => p.value === selectedLead.priority);
                            return p ? <p.icon className={`w-3.5 h-3.5 ${p.color}`} /> : <Thermometer className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />;
                          })()}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {PRIORITY_OPTIONS.map(p => (
                          <DropdownMenuItem key={p.value} onClick={() => handleUpdatePriority(selectedLead, p.value)}>
                            <p.icon className={`w-4 h-4 mr-2 ${p.color}`} /> {p.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[13px]" onClick={() => { setEditingLead(selectedLead); setShowLeadForm(true); }}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-gray-400 dark:text-gray-500 hover:text-red-600" onClick={() => setDeleteDialog({ open: true, leadId: selectedLead.id })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              {/* Inline metric strip */}
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
                <span>Value <span className="text-gray-900 dark:text-gray-100 font-medium">${selectedLead.estimated_value?.toLocaleString() || 0}</span></span>
                <span>Status <span className="text-gray-900 dark:text-gray-100 font-medium capitalize">{selectedLead.status}</span></span>
                <span>Email <span className="text-gray-900 dark:text-gray-100 font-medium">{selectedLead.email || "—"}</span></span>
                <span>Phone <span className="text-gray-900 dark:text-gray-100 font-medium">{selectedLead.phone || "—"}</span></span>
              </div>

              {selectedLead.next_action && (
                <div className="mt-4 border-t border-gray-200 dark:border-gray-800 pt-3">
                  <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">Next action</div>
                  <p className="text-[13px] text-gray-900 dark:text-gray-100">{selectedLead.next_action}</p>
                  {selectedLead.next_action_date && (
                    <p className="text-[11px] text-gray-500 mt-0.5">Due: {new Date(selectedLead.next_action_date).toLocaleDateString()}</p>
                  )}
                </div>
              )}

              {isPartnerReferral(selectedLead) && (
                <div className="mt-4 border-t border-gray-200 dark:border-gray-800 pt-3">
                  <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Partner Referral
                  </div>
                  <p className="text-[13px] text-gray-900 dark:text-gray-100">{selectedLead.source}</p>
                </div>
              )}

              {/* Log Activity */}
              <div className="mt-5 border-t border-gray-200 dark:border-gray-800 pt-4">
                <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">Log activity</div>
                <div className="flex gap-1 mb-2 mt-1">
                  {ACTIVITY_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setActivityType(type.value)}
                      className={`inline-flex items-center gap-1 h-7 px-2 rounded text-[13px] ${
                        activityType === type.value
                          ? "bg-gray-900 text-white"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <type.icon className="w-3.5 h-3.5" />
                      {type.label}
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder={`What happened in this ${activityType}?`}
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  rows={2}
                  className="text-[13px]"
                />
                <Button
                  className="mt-2 bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
                  onClick={handleLogActivity}
                  disabled={savingActivity || !activityDescription.trim()}
                >
                  {savingActivity ? "Saving…" : "Log Activity"}
                </Button>
              </div>

              {/* Activity Timeline */}
              <div className="mt-5 border-t border-gray-200 dark:border-gray-800 pt-4">
                <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">Activity timeline</div>
                {loadingActivities ? (
                  <div className="text-center py-4">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-[13px] text-gray-500 text-center py-4">No activities yet</p>
                ) : (
                  <div className="border-t border-gray-200 dark:border-gray-800">
                    {activities.map((activity) => {
                      const typeInfo = ACTIVITY_TYPES.find(t => t.value === activity.type);
                      const Icon = typeInfo?.icon || MessageSquare;
                      return (
                        <div key={activity.id} className="flex items-start gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                          <div className={`w-6 h-6 rounded-full ${typeInfo?.bg || "bg-gray-100 dark:bg-gray-800"} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-3.5 h-3.5 ${typeInfo?.color || "text-gray-600 dark:text-gray-400"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium">{typeInfo?.label || activity.type}</span>
                              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                {new Date(activity.created_at).toLocaleDateString()} at {new Date(activity.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-[12px] text-gray-600 dark:text-gray-400 mt-0.5">{activity.description}</p>
                            {activity.user_profiles?.full_name && (
                              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">by {activity.user_profiles.full_name}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Lead Form Sheet */}
      <FormShell
        open={showLeadForm}
        onOpenChange={setShowLeadForm}
        storageKey="hdo.leadForm.viewMode"
        title={editingLead ? "Edit Lead" : "Add New Lead"}
        description={editingLead ? "Update lead details" : "Create a new lead"}
      >
        <LeadForm
          lead={editingLead}
          teamMembers={teamMembers}
          onSubmit={handleSubmitLead}
          onCancel={() => { setShowLeadForm(false); setEditingLead(null); }}
        />
      </FormShell>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
            <DialogDescription>Are you sure? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, leadId: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
