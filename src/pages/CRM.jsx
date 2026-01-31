import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { Lead, TeamMember } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Plus,
  Building2,
  Mail,
  Phone,
  DollarSign,
  Calendar,
  User,
  Trash2,
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
  MessageSquare,
  PhoneCall,
  CalendarPlus,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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

export default function CRM() {
  const [leads, setLeads] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, leadId: null });
  const [viewMode, setViewMode] = useState("kanban"); // kanban or list
  const [collapsedColumns, setCollapsedColumns] = useState({ won: false, lost: false });
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ source: "", assignedTo: "", priority: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [activityDialog, setActivityDialog] = useState({ open: false, lead: null, type: null });
  const [activityNote, setActivityNote] = useState("");

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

  const handleSubmit = async (leadData) => {
    if (editingLead) {
      await Lead.update(editingLead.id, leadData);
    } else {
      await Lead.create(leadData);
    }
    setShowDrawer(false);
    setEditingLead(null);
    loadData();
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const lead = leads.find(l => l.id === draggableId);
    if (lead && source.droppableId !== destination.droppableId) {
      await Lead.update(lead.id, { ...lead, status: destination.droppableId });

      // Auto-approve referral when lead is marked as won
      if (destination.droppableId === "won" && lead.referral_id) {
        await supabase
          .from("referrals")
          .update({ status: "active" })
          .eq("id", lead.referral_id);
      }

      loadData();
    }
  };

  const handleDelete = async () => {
    if (deleteDialog.leadId) {
      await Lead.delete(deleteDialog.leadId);
      setDeleteDialog({ open: false, leadId: null });
      loadData();
    }
  };

  const handleEditLead = (lead) => {
    setEditingLead(lead);
    setShowDrawer(true);
  };

  const handleQuickAction = async (type) => {
    if (!activityDialog.lead) return;

    const lead = activityDialog.lead;
    const now = new Date().toISOString();

    // Update lead with activity note and last contact date
    const updateData = {
      notes: lead.notes
        ? `${lead.notes}\n\n[${type.toUpperCase()} - ${new Date().toLocaleDateString()}] ${activityNote}`
        : `[${type.toUpperCase()} - ${new Date().toLocaleDateString()}] ${activityNote}`,
    };

    if (type === "call" || type === "email") {
      updateData.last_contact = now.split("T")[0];
    }

    await Lead.update(lead.id, { ...lead, ...updateData });
    setActivityDialog({ open: false, lead: null, type: null });
    setActivityNote("");
    loadData();
  };

  const handleUpdatePriority = async (lead, priority) => {
    await Lead.update(lead.id, { ...lead, priority });
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

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !lead.company_name?.toLowerCase().includes(query) &&
          !lead.contact_name?.toLowerCase().includes(query) &&
          !lead.email?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      if (filters.source && lead.source !== filters.source) return false;
      if (filters.assignedTo && lead.assigned_to !== filters.assignedTo) return false;
      if (filters.priority && lead.priority !== filters.priority) return false;
      return true;
    });
  }, [leads, searchQuery, filters]);

  const getLeadsByStatus = (status) => {
    return filteredLeads.filter(lead => lead.status === status);
  };

  // Calculate stats
  const stats = useMemo(() => {
    const activeLeads = leads.filter(l => l.status !== "lost" && l.status !== "won");
    const pipelineValue = activeLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
    const wonValue = leads.filter(l => l.status === "won").reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
    const conversionRate = leads.length > 0
      ? ((leads.filter(l => l.status === "won").length / leads.filter(l => l.status === "won" || l.status === "lost").length) * 100) || 0
      : 0;

    // Stale leads (not updated in 7+ days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const staleLeads = activeLeads.filter(l => {
      const lastUpdate = new Date(l.updated_at || l.created_at);
      return lastUpdate < sevenDaysAgo;
    }).length;

    return { pipelineValue, wonValue, activeLeads: activeLeads.length, conversionRate, staleLeads };
  }, [leads]);

  const sourceColors = {
    referral: "bg-purple-100 text-purple-700",
    website: "bg-blue-100 text-blue-700",
    linkedin: "bg-indigo-100 text-indigo-700",
    cold_outreach: "bg-gray-100 text-gray-700",
    event: "bg-green-100 text-green-700",
    other: "bg-gray-100 text-gray-700"
  };

  const getLeadAge = (lead) => {
    const created = new Date(lead.created_at);
    const now = new Date();
    const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getStageAge = (lead) => {
    const updated = new Date(lead.updated_at || lead.created_at);
    const now = new Date();
    const days = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
    return days;
  };

  const isStale = (lead) => {
    if (lead.status === "won" || lead.status === "lost") return false;
    return getStageAge(lead) >= 7;
  };

  const isPartnerReferral = (lead) => {
    return lead.referral_id || lead.source?.toLowerCase().includes("partner");
  };

  const toggleColumn = (columnId) => {
    setCollapsedColumns(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  // LeadCard component
  const LeadCard = ({ lead, onEdit, isDragging }) => {
    const stale = isStale(lead);
    const partnerReferral = isPartnerReferral(lead);
    const priority = PRIORITY_OPTIONS.find(p => p.value === lead.priority);
    const PriorityIcon = priority?.icon;

    return (
      <Card
        className={`hover:shadow-lg transition-all cursor-pointer
          ${lead.status === 'won' ? 'bg-green-50 border-green-200' :
            lead.status === 'lost' ? 'bg-red-50 border-red-200' :
            stale ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-300' :
            'bg-white'}
          ${isDragging ? 'shadow-2xl ring-2 ring-indigo-400 rotate-2' : ''}
        `}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1" onClick={() => onEdit(lead)}>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900 line-clamp-1">
                    {lead.company_name}
                  </h4>
                  {partnerReferral && (
                    <Badge className="bg-purple-100 text-purple-700 text-xs px-1.5">
                      <Users className="w-3 h-3 mr-0.5" />
                      Partner
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {lead.contact_name}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {/* Priority Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      {PriorityIcon ? (
                        <PriorityIcon className={`w-4 h-4 ${priority.color}`} />
                      ) : (
                        <Thermometer className="w-4 h-4 text-gray-300" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {PRIORITY_OPTIONS.map(p => (
                      <DropdownMenuItem
                        key={p.value}
                        onClick={() => handleUpdatePriority(lead, p.value)}
                      >
                        <p.icon className={`w-4 h-4 mr-2 ${p.color}`} />
                        {p.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {lead.estimated_value && (
                  <Badge className="bg-green-50 text-green-700 border-green-200 flex-shrink-0">
                    <DollarSign className="w-3 h-3 mr-0.5" />
                    {(lead.estimated_value / 1000).toFixed(0)}k
                  </Badge>
                )}
              </div>
            </div>

            {/* Stale Warning */}
            {stale && (
              <div className="flex items-center gap-1 text-amber-600 text-xs bg-amber-100 px-2 py-1 rounded">
                <AlertCircle className="w-3 h-3" />
                Stale ({getStageAge(lead)} days in stage)
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex items-center gap-1 pt-1 border-t border-gray-100">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-gray-500 hover:text-blue-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivityDialog({ open: true, lead, type: "email" });
                }}
              >
                <Mail className="w-3 h-3 mr-1" />
                Email
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-gray-500 hover:text-green-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivityDialog({ open: true, lead, type: "call" });
                }}
              >
                <PhoneCall className="w-3 h-3 mr-1" />
                Call
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-gray-500 hover:text-purple-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivityDialog({ open: true, lead, type: "meeting" });
                }}
              >
                <CalendarPlus className="w-3 h-3 mr-1" />
                Meet
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteDialog({ open: true, leadId: lead.id });
                }}
                className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>

            {/* Info Section */}
            <div className="space-y-2 pt-1" onClick={() => onEdit(lead)}>
              {/* Source & Age */}
              <div className="flex items-center gap-2 flex-wrap">
                {lead.source && (
                  <Badge
                    variant="outline"
                    className={`${sourceColors[lead.source] || sourceColors.other} text-xs`}
                  >
                    {lead.source.replace('_', ' ')}
                  </Badge>
                )}
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {getLeadAge(lead)}d old
                </span>
              </div>

              {/* Next Action */}
              {lead.next_action && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-700 line-clamp-2">
                    {lead.next_action}
                  </p>
                  {lead.next_action_date && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      {new Date(lead.next_action_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // List View Row
  const ListViewRow = ({ lead }) => {
    const stale = isStale(lead);
    const partnerReferral = isPartnerReferral(lead);
    const priority = PRIORITY_OPTIONS.find(p => p.value === lead.priority);
    const PriorityIcon = priority?.icon;
    const column = columns.find(c => c.id === lead.status);

    return (
      <TableRow className={stale ? "bg-amber-50" : ""}>
        <TableCell>
          <div className="flex items-center gap-2">
            {PriorityIcon && <PriorityIcon className={`w-4 h-4 ${priority.color}`} />}
            <div>
              <div className="font-medium flex items-center gap-2">
                {lead.company_name}
                {partnerReferral && (
                  <Badge className="bg-purple-100 text-purple-700 text-xs">Partner</Badge>
                )}
                {stale && (
                  <Badge className="bg-amber-100 text-amber-700 text-xs">Stale</Badge>
                )}
              </div>
              <div className="text-sm text-gray-500">{lead.contact_name}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>{lead.email}</TableCell>
        <TableCell>
          <Badge className={`${column?.bgLight} ${column?.textColor}`}>
            {column?.label}
          </Badge>
        </TableCell>
        <TableCell>
          {lead.estimated_value ? `$${lead.estimated_value.toLocaleString()}` : "—"}
        </TableCell>
        <TableCell>
          {lead.source && (
            <Badge variant="outline" className={sourceColors[lead.source] || sourceColors.other}>
              {lead.source.replace('_', ' ')}
            </Badge>
          )}
        </TableCell>
        <TableCell>{getLeadAge(lead)}d</TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => handleEditLead(lead)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500"
              onClick={() => setDeleteDialog({ open: true, leadId: lead.id })}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
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
              {/* Stats */}
              <div className="hidden lg:flex items-center gap-6">
                <div>
                  <p className="text-sm text-gray-600">Pipeline Value</p>
                  <p className="text-2xl font-bold text-indigo-600">${stats.pipelineValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Won Deals</p>
                  <p className="text-2xl font-bold text-green-600">${stats.wonValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeLeads}</p>
                </div>
                {stats.staleLeads > 0 && (
                  <div>
                    <p className="text-sm text-amber-600">Stale</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.staleLeads}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Win Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.conversionRate.toFixed(0)}%</p>
                </div>
              </div>
              <Button
                onClick={() => {
                  setEditingLead(null);
                  setShowDrawer(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            </div>
          </div>

          {/* Search, Filters, View Toggle */}
          <div className="flex items-center gap-4 mt-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {(filters.source || filters.assignedTo || filters.priority) && (
                <Badge className="ml-2 bg-indigo-600 text-white">
                  {[filters.source, filters.assignedTo, filters.priority].filter(Boolean).length}
                </Badge>
              )}
            </Button>

            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="rounded-none"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-none"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Filter Row */}
          {showFilters && (
            <div className="flex items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
              <Select
                value={filters.source}
                onValueChange={(value) => setFilters({ ...filters, source: value })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Sources</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.assignedTo}
                onValueChange={(value) => setFilters({ ...filters, assignedTo: value })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Assigned To" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Team</SelectItem>
                  {teamMembers.map(tm => (
                    <SelectItem key={tm.id} value={tm.id}>{tm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.priority}
                onValueChange={(value) => setFilters({ ...filters, priority: value })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Priorities</SelectItem>
                  {PRIORITY_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <p.icon className={`w-4 h-4 ${p.color}`} />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(filters.source || filters.assignedTo || filters.priority) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({ source: "", assignedTo: "", priority: "" })}
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
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
                      <div
                        key={column.id}
                        className="flex-shrink-0 w-12 flex flex-col cursor-pointer"
                        onClick={() => toggleColumn(column.id)}
                      >
                        <div className={`flex-1 ${column.bgLight} rounded-xl flex flex-col items-center py-4`}>
                          <div className={`w-3 h-3 rounded-full ${column.color} mb-2`}></div>
                          <span className="text-xs font-medium text-gray-600 writing-mode-vertical transform rotate-180" style={{ writingMode: "vertical-rl" }}>
                            {column.label} ({columnLeads.length})
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400 mt-2" />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={column.id} className="flex-shrink-0 w-80 flex flex-col">
                      {/* Column Header */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                            <h3 className="font-semibold text-gray-900">{column.label}</h3>
                            <Badge variant="secondary" className="bg-gray-100">
                              {columnLeads.length}
                            </Badge>
                          </div>
                          {canCollapse && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleColumn(column.id)}
                              className="h-6 w-6 p-0"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-600">
                          ${columnValue.toLocaleString()}
                        </p>
                      </div>

                      {/* Column Content */}
                      <Droppable droppableId={column.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 rounded-xl transition-colors ${
                              snapshot.isDraggingOver
                                ? `${column.bgLight} ring-2 ring-${column.color}`
                                : 'bg-gray-50'
                            } p-3 overflow-y-auto`}
                          >
                            <div className="space-y-3">
                              {columnLeads.map((lead, index) => (
                                <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                    >
                                      <LeadCard
                                        lead={lead}
                                        onEdit={handleEditLead}
                                        isDragging={snapshot.isDragging}
                                      />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}

                              {columnLeads.length === 0 && (
                                <div className="text-center py-8 text-gray-400">
                                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No leads yet</p>
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
                      <TableHead>Source</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map(lead => (
                      <ListViewRow key={lead.id} lead={lead} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Lead Form Sheet */}
      <Sheet open={showDrawer} onOpenChange={setShowDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingLead ? "Edit Lead" : "Add New Lead"}</SheetTitle>
            <SheetDescription>
              {editingLead ? "Update lead information" : "Add a new lead to your pipeline"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <LeadForm
              lead={editingLead}
              teamMembers={teamMembers}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowDrawer(false);
                setEditingLead(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this lead? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, leadId: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity Log Dialog */}
      <Dialog open={activityDialog.open} onOpenChange={(open) => setActivityDialog({ ...activityDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Log {activityDialog.type === "email" ? "Email" : activityDialog.type === "call" ? "Call" : "Meeting"}
            </DialogTitle>
            <DialogDescription>
              Add a note about your {activityDialog.type} with {activityDialog.lead?.contact_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder={`What was discussed in the ${activityDialog.type}?`}
              value={activityNote}
              onChange={(e) => setActivityNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActivityDialog({ open: false, lead: null, type: null });
                setActivityNote("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => handleQuickAction(activityDialog.type)}>
              Log Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
