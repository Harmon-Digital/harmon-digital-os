import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
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
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  Trash2,
  ExternalLink,
  ArrowUpDown,
  Check,
  X,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-gray-100 text-gray-700" },
  { value: "contacted", label: "Contacted", color: "bg-blue-100 text-blue-700" },
  { value: "responded", label: "Responded", color: "bg-purple-100 text-purple-700" },
  { value: "call_booked", label: "Call Booked", color: "bg-yellow-100 text-yellow-700" },
  { value: "call_complete", label: "Call Complete", color: "bg-indigo-100 text-indigo-700" },
  { value: "partnered", label: "Partnered", color: "bg-green-100 text-green-700" },
  { value: "dead", label: "Dead", color: "bg-red-100 text-red-700" },
];

const VIEWS = [
  { id: "all", label: "All Brokers" },
  { id: "need_contact", label: "Need to Contact" },
  { id: "waiting", label: "Waiting on Response" },
  { id: "active", label: "Active Pipeline" },
  { id: "partners", label: "Partners" },
];

export default function BrokerOutreach() {
  const [brokers, setBrokers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState("all");
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [showAddDialog, setShowAddDialog] = useState(false);
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

  useEffect(() => {
    loadBrokers();
  }, []);

  const loadBrokers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("brokers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading brokers:", error);
    } else {
      setBrokers(data || []);
    }
    setLoading(false);
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

    // Apply view filter
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

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.name?.toLowerCase().includes(query) ||
        b.firm?.toLowerCase().includes(query) ||
        b.email?.toLowerCase().includes(query)
      );
    }

    // Apply sort
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

  // View counts
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
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
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
                <TableCell colSpan={7}></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
