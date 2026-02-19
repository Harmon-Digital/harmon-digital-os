import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { Lead, TeamMember } from "@/api/entities";
import { sendNotification } from "@/api/functions";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  DollarSign,
  Calendar,
  User,
  Search,
  Filter,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertCircle,
  Flame,
  Thermometer,
  Snowflake,
  Users,
  Mail,
  PhoneCall,
  CalendarPlus,
  MessageSquare,
  X,
  Trash2,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import LeadForm from "../components/crm/LeadForm";

const PRIORITY_OPTIONS = [
  { value: "hot", label: "Hot", icon: Flame, color: "text-red-500", bg: "bg-red-100" },
  { value: "warm", label: "Warm", icon: Thermometer, color: "text-orange-500", bg: "bg-orange-100" },
  { value: "cold", label: "Cold", icon: Snowflake, color: "text-blue-500", bg: "bg-blue-100" },
];

const ACTIVITY_TYPES = [
  { value: "call", label: "Call", icon: PhoneCall, color: "text-green-600", bg: "bg-green-100" },
  { value: "email", label: "Email", icon: Mail, color: "text-blue-600", bg: "bg-blue-100" },
  { value: "meeting", label: "Meeting", icon: CalendarPlus, color: "text-purple-600", bg: "bg-purple-100" },
  { value: "note", label: "Note", icon: MessageSquare, color: "text-gray-600", bg: "bg-gray-100" },
];

export default function CRM() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [viewMode, setViewMode] = useState("kanban");
  const [collapsedColumns, setCollapsedColumns] = useState({ won: false, lost: false });
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ source: "", assignedTo: "", priority: "" });
  const [showFilters, setShowFilters] = useState(false);

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
    const [leadsData, teamMembersData] = await Promise.all([
      Lead.list("-created_at"),
      TeamMember.list()
    ]);
    setLeads(leadsData);
    setTeamMembers(teamMembersData);
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
      await Lead.update(lead.id, { ...lead, status: destination.droppableId });

      // Auto-approve referral when lead is marked as won
      if (destination.droppableId === "won" && lead.referral_id) {
        await supabase.from("referrals").update({ status: "active" }).eq("id", lead.referral_id);
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
      await supabase.from("lead_activities").insert({
        lead_id: selectedLead.id,
        type: activityType,
        description: activityDescription,
        created_by: user?.id,
      });

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
    await Lead.update(lead.id, { ...lead, priority });
    if (selectedLead?.id === lead.id) {
      setSelectedLead({ ...lead, priority });
    }
    loadData();
  };

  const columns = [
    { id: "new", label: "New", color: "bg-purple-500", textColor: "text-purple-500", bgLight: "bg-purple-50" },
    { id: "contacted", label: "Contacted", color: "bg-blue-500", textColor: "text-blue-500", bgLight: "bg-blue-50" },
    { id: "qualified", label: "Qualified", color: "bg-indigo-500", textColor: "text-indigo-500", bgLight: "bg-indigo-50" },
    { id: "proposal", label: "Proposal", color: "bg-yellow-500", textColor: "text-yellow-500", bgLight: "bg-yellow-50" },
    { id: "negotiation", label: "Negotiation", color: "bg-orange-500", textColor: "text-orange-500", bgLight: "bg-orange-50" },
    { id: "won", label: "Won", color: "bg-green-500", textColor: "text-green-500", bgLight: "bg-green-50" },
    { id: "lost", label: "Lost", color: "bg-red-500", textColor: "text-red-500", bgLight: "bg-red-50" },
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
      if (filters.source && lead.source !== filters.source) return false;
      if (filters.assignedTo && lead.assigned_to !== filters.assignedTo) return false;
      if (filters.priority && lead.priority !== filters.priority) return false;
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

  // Simplified Lead Card
  const LeadCard = ({ lead, isDragging }) => {
    const stale = isStale(lead);
    const partnerReferral = isPartnerReferral(lead);
    const priority = PRIORITY_OPTIONS.find(p => p.value === lead.priority);
    const PriorityIcon = priority?.icon;

    return (
      <Card
        onClick={() => handleOpenLeadDetail(lead)}
        className={`cursor-pointer hover:shadow-md transition-all
          ${stale ? 'border-amber-300 bg-amber-50/50' : ''}
          ${lead.status === 'won' ? 'bg-green-50 border-green-200' : ''}
          ${lead.status === 'lost' ? 'bg-red-50 border-red-200' : ''}
          ${isDragging ? 'shadow-xl ring-2 ring-indigo-400 rotate-1' : ''}
        `}
      >
        <CardContent className="p-3">
          {/* Row 1: Company + Value */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {PriorityIcon && <PriorityIcon className={`w-4 h-4 flex-shrink-0 ${priority.color}`} />}
              <span className="font-medium text-gray-900 truncate">{lead.company_name}</span>
            </div>
            {lead.estimated_value > 0 && (
              <Badge className="bg-green-100 text-green-700 flex-shrink-0">
                ${(lead.estimated_value / 1000).toFixed(0)}k
              </Badge>
            )}
          </div>

          {/* Row 2: Contact */}
          <div className="flex items-center gap-1 mt-1.5 text-sm text-gray-500">
            <User className="w-3 h-3" />
            <span className="truncate">{lead.contact_name}</span>
          </div>

          {/* Row 3: Badges */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {partnerReferral && (
              <Badge className="bg-purple-100 text-purple-700 text-xs">
                <Users className="w-3 h-3 mr-0.5" />
                Partner
              </Badge>
            )}
            {stale && (
              <Badge className="bg-amber-100 text-amber-700 text-xs">
                <AlertCircle className="w-3 h-3 mr-0.5" />
                {getStageAge(lead)}d
              </Badge>
            )}
            {lead.next_action_date && (
              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                <Calendar className="w-3 h-3" />
                {new Date(lead.next_action_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // List View Row
  const ListViewRow = ({ lead }) => {
    const stale = isStale(lead);
    const column = columns.find(c => c.id === lead.status);

    return (
      <TableRow
        className={`cursor-pointer hover:bg-gray-50 ${stale ? "bg-amber-50" : ""}`}
        onClick={() => handleOpenLeadDetail(lead)}
      >
        <TableCell>
          <div className="font-medium">{lead.company_name}</div>
          <div className="text-sm text-gray-500">{lead.contact_name}</div>
        </TableCell>
        <TableCell>{lead.email}</TableCell>
        <TableCell>
          <Badge className={`${column?.bgLight} ${column?.textColor}`}>{column?.label}</Badge>
        </TableCell>
        <TableCell>{lead.estimated_value ? `$${lead.estimated_value.toLocaleString()}` : "—"}</TableCell>
        <TableCell>
          {lead.next_action_date ? new Date(lead.next_action_date).toLocaleDateString() : "—"}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="border-b bg-white shadow-sm">
        <div className="p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sales Pipeline</h1>
              <p className="text-gray-500 mt-1">Track leads through your sales process</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-6">
                <div>
                  <p className="text-sm text-gray-600">Pipeline</p>
                  <p className="text-xl font-bold text-indigo-600">${stats.pipelineValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Won</p>
                  <p className="text-xl font-bold text-green-600">${stats.wonValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-xl font-bold text-gray-900">{stats.activeLeads}</p>
                </div>
                {stats.staleLeads > 0 && (
                  <div>
                    <p className="text-sm text-amber-600">Stale</p>
                    <p className="text-xl font-bold text-amber-600">{stats.staleLeads}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Win Rate</p>
                  <p className="text-xl font-bold text-gray-900">{stats.conversionRate.toFixed(0)}%</p>
                </div>
              </div>
              <Button onClick={() => { setEditingLead(null); setShowLeadForm(true); }} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-4 mt-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search leads..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Button variant={showFilters ? "default" : "outline"} onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("kanban")} className="rounded-none">
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="rounded-none">
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="flex items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
              <Select value={filters.source} onValueChange={(value) => setFilters({ ...filters, source: value })}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Sources</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Priorities</SelectItem>
                  {PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {(filters.source || filters.priority) && (
                <Button variant="ghost" size="sm" onClick={() => setFilters({ source: "", assignedTo: "", priority: "" })}>
                  <X className="w-4 h-4 mr-1" /> Clear
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "kanban" ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="h-full overflow-x-auto">
              <div className="inline-flex h-full gap-4 p-6 lg:p-8 min-w-full">
                {columns.map((column) => {
                  const columnLeads = getLeadsByStatus(column.id);
                  const columnValue = columnLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
                  const isCollapsed = collapsedColumns[column.id];
                  const canCollapse = column.id === "won" || column.id === "lost";

                  if (isCollapsed) {
                    return (
                      <div key={column.id} className="flex-shrink-0 w-12 cursor-pointer" onClick={() => toggleColumn(column.id)}>
                        <div className={`h-full ${column.bgLight} rounded-xl flex flex-col items-center py-4`}>
                          <div className={`w-3 h-3 rounded-full ${column.color} mb-2`} />
                          <span className="text-xs font-medium text-gray-600" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                            {column.label} ({columnLeads.length})
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400 mt-2" />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={column.id} className="flex-shrink-0 w-72 flex flex-col">
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${column.color}`} />
                            <h3 className="font-semibold text-gray-900 text-sm">{column.label}</h3>
                            <Badge variant="secondary" className="bg-gray-100 text-xs">{columnLeads.length}</Badge>
                          </div>
                          {canCollapse && (
                            <Button variant="ghost" size="sm" onClick={() => toggleColumn(column.id)} className="h-6 w-6 p-0">
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">${columnValue.toLocaleString()}</p>
                      </div>

                      <Droppable droppableId={column.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 rounded-xl transition-colors ${snapshot.isDraggingOver ? column.bgLight : 'bg-gray-50/50'} p-2 overflow-y-auto`}
                          >
                            <div className="space-y-2">
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
                                <div className="text-center py-8 text-gray-400">
                                  <Building2 className="w-6 h-6 mx-auto mb-1 opacity-50" />
                                  <p className="text-xs">No leads</p>
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
          <div className="p-6 lg:p-8 overflow-auto h-full">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Next Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map(lead => <ListViewRow key={lead.id} lead={lead} />)}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
                    <SheetTitle className="text-xl">{selectedLead.company_name}</SheetTitle>
                    <p className="text-gray-500 mt-1">{selectedLead.contact_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Priority Selector */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          {(() => {
                            const p = PRIORITY_OPTIONS.find(p => p.value === selectedLead.priority);
                            return p ? <p.icon className={`w-4 h-4 ${p.color}`} /> : <Thermometer className="w-4 h-4 text-gray-400" />;
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
                    <Button variant="outline" size="sm" onClick={() => { setEditingLead(selectedLead); setShowLeadForm(true); }}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600" onClick={() => setDeleteDialog({ open: true, leadId: selectedLead.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              {/* Lead Info */}
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Value</p>
                    <p className="font-medium">${selectedLead.estimated_value?.toLocaleString() || 0}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="font-medium capitalize">{selectedLead.status}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-medium text-sm truncate">{selectedLead.email || "—"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="font-medium">{selectedLead.phone || "—"}</p>
                  </div>
                </div>

                {selectedLead.next_action && (
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <p className="text-xs text-indigo-600 font-medium">Next Action</p>
                    <p className="text-sm mt-1">{selectedLead.next_action}</p>
                    {selectedLead.next_action_date && (
                      <p className="text-xs text-indigo-500 mt-1">Due: {new Date(selectedLead.next_action_date).toLocaleDateString()}</p>
                    )}
                  </div>
                )}

                {isPartnerReferral(selectedLead) && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-xs text-purple-600 font-medium flex items-center gap-1">
                      <Users className="w-3 h-3" /> Partner Referral
                    </p>
                    <p className="text-sm mt-1">{selectedLead.source}</p>
                  </div>
                )}
              </div>

              {/* Log Activity */}
              <div className="mt-6 border-t pt-6">
                <h3 className="font-medium text-gray-900 mb-3">Log Activity</h3>
                <div className="flex gap-2 mb-3">
                  {ACTIVITY_TYPES.map(type => (
                    <Button
                      key={type.value}
                      variant={activityType === type.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActivityType(type.value)}
                      className={activityType === type.value ? "" : ""}
                    >
                      <type.icon className="w-4 h-4 mr-1" />
                      {type.label}
                    </Button>
                  ))}
                </div>
                <Textarea
                  placeholder={`What happened in this ${activityType}?`}
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  rows={2}
                />
                <Button className="mt-2" onClick={handleLogActivity} disabled={savingActivity || !activityDescription.trim()}>
                  {savingActivity ? "Saving..." : "Log Activity"}
                </Button>
              </div>

              {/* Activity Timeline */}
              <div className="mt-6 border-t pt-6">
                <h3 className="font-medium text-gray-900 mb-3">Activity Timeline</h3>
                {loadingActivities ? (
                  <div className="text-center py-4">
                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No activities yet</p>
                ) : (
                  <div className="space-y-3">
                    {activities.map((activity) => {
                      const typeInfo = ACTIVITY_TYPES.find(t => t.value === activity.type);
                      const Icon = typeInfo?.icon || MessageSquare;
                      return (
                        <div key={activity.id} className="flex gap-3">
                          <div className={`w-8 h-8 rounded-full ${typeInfo?.bg || 'bg-gray-100'} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${typeInfo?.color || 'text-gray-600'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{typeInfo?.label || activity.type}</span>
                              <span className="text-xs text-gray-400">
                                {new Date(activity.created_at).toLocaleDateString()} at {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-0.5">{activity.description}</p>
                            {activity.user_profiles?.full_name && (
                              <p className="text-xs text-gray-400 mt-1">by {activity.user_profiles.full_name}</p>
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
      <Sheet open={showLeadForm} onOpenChange={setShowLeadForm}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingLead ? "Edit Lead" : "Add New Lead"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <LeadForm
              lead={editingLead}
              teamMembers={teamMembers}
              onSubmit={handleSubmitLead}
              onCancel={() => { setShowLeadForm(false); setEditingLead(null); }}
            />
          </div>
        </SheetContent>
      </Sheet>

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
