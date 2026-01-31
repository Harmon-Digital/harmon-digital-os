import React, { useState, useEffect } from "react";
import { Lead, TeamMember } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Mail, Phone, DollarSign, Calendar, User, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import LeadForm from "../components/crm/LeadForm";

export default function CRM() {
  const [leads, setLeads] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
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

    // If dropped in the same position, do nothing
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Update lead status
    const lead = leads.find(l => l.id === draggableId);
    if (lead && source.droppableId !== destination.droppableId) {
      await Lead.update(lead.id, { ...lead, status: destination.droppableId });
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

  const columns = [
    { id: "new", label: "New", color: "bg-purple-500", textColor: "text-purple-500", bgLight: "bg-purple-50" },
    { id: "contacted", label: "Contacted", color: "bg-blue-500", textColor: "text-blue-500", bgLight: "bg-blue-50" },
    { id: "qualified", label: "Qualified", color: "bg-indigo-500", textColor: "text-indigo-500", bgLight: "bg-indigo-50" },
    { id: "proposal", label: "Proposal", color: "bg-yellow-500", textColor: "text-yellow-500", bgLight: "bg-yellow-50" },
    { id: "negotiation", label: "Negotiation", color: "bg-orange-500", textColor: "text-orange-500", bgLight: "bg-orange-50" },
    { id: "won", label: "Won", color: "bg-green-500", textColor: "text-green-500", bgLight: "bg-green-50" },
    { id: "lost", label: "Lost", color: "bg-red-500", textColor: "text-red-500", bgLight: "bg-red-50" },
  ];

  const getLeadsByStatus = (status) => {
    return leads.filter(lead => lead.status === status);
  };

  const pipelineValue = leads
    .filter(l => l.status !== "lost" && l.status !== "won")
    .reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);

  const wonValue = leads
    .filter(l => l.status === "won")
    .reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);

  const sourceColors = {
    referral: "bg-purple-100 text-purple-700",
    website: "bg-blue-100 text-blue-700",
    linkedin: "bg-indigo-100 text-indigo-700",
    cold_outreach: "bg-gray-100 text-gray-700",
    event: "bg-green-100 text-green-700",
    other: "bg-gray-100 text-gray-700"
  };

  // LeadCard component to encapsulate rendering logic
  const LeadCard = ({ lead, onEdit, isDragging }) => (
    <Card
      className={`hover:shadow-lg transition-all 
        ${lead.status === 'won' ? 'bg-green-50 border-green-200' :
          lead.status === 'lost' ? 'bg-red-50 border-red-200' :
          'bg-white'}
        ${isDragging ? 'shadow-2xl ring-2 ring-indigo-400 rotate-2' : ''}
      `}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 cursor-pointer" onClick={() => onEdit(lead)}>
              <h4 className="font-semibold text-gray-900 line-clamp-1">
                {lead.company_name}
              </h4>
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                <User className="w-3 h-3" />
                {lead.contact_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lead.estimated_value && (
                <Badge className="bg-green-50 text-green-700 border-green-200 flex-shrink-0">
                  <DollarSign className="w-3 h-3 mr-1" />
                  {(lead.estimated_value / 1000).toFixed(0)}k
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent card's onClick from firing
                  setDeleteDialog({ open: true, leadId: lead.id });
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Contact Info, Source Badge, Next Action (clickable for editing) */}
          <div className="space-y-3 cursor-pointer" onClick={() => onEdit(lead)}>
            {/* Contact Info */}
            <div className="space-y-1">
              {lead.email && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{lead.email}</span>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Phone className="w-3 h-3" />
                  <span>{lead.phone}</span>
                </div>
              )}
            </div>

            {/* Source Badge */}
            {lead.source && (
              <Badge
                variant="outline"
                className={`${sourceColors[lead.source]} text-xs`}
              >
                {lead.source.replace('_', ' ')}
              </Badge>
            )}

            {/* Next Action */}
            {lead.next_action && (
              <div className="pt-3 border-t border-gray-100">
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
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-gray-600">Pipeline Value</p>
                  <p className="text-2xl font-bold text-indigo-600">${pipelineValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Won Deals</p>
                  <p className="text-2xl font-bold text-green-600">${wonValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Leads</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {leads.filter(l => l.status !== "won" && l.status !== "lost").length}
                  </p>
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
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="h-full overflow-x-auto">
            <div className="inline-flex h-full gap-4 p-6 lg:p-8 min-w-full">
              {columns.map((column) => {
                const columnLeads = getLeadsByStatus(column.id);
                const columnValue = columnLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);

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
      </div>

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
    </div>
  );
}