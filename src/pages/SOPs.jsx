
import React, { useState, useEffect } from "react";
import { api } from "@/api/legacyClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, FileText, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function SOPs() {
  const [sops, setSops] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingSOP, setEditingSOP] = useState(null);
  const [viewingSOP, setViewingSOP] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState({ open: false, sopId: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const sopsData = await api.entities.SOP.list("-created_at");
      setSops(sopsData);
    } catch (error) {
      console.error("Error loading SOPs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (sopData) => {
    try {
      if (editingSOP) {
        await api.entities.SOP.update(editingSOP.id, sopData);
      } else {
        await api.entities.SOP.create(sopData);
      }
      setShowDrawer(false);
      setEditingSOP(null);
      loadData();
    } catch (error) {
      console.error("Error saving SOP:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await api.entities.SOP.delete(deleteDialog.sopId);
      setDeleteDialog({ open: false, sopId: null });
      loadData();
    } catch (error) {
      console.error("Error deleting SOP:", error);
    }
  };

  const filteredSOPs = sops.filter(sop => {
    const matchesSearch = !searchQuery ||
      sop.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sop.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === "all" || sop.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || sop.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = [
    { value: "client", label: "Client Management" },
    { value: "project", label: "Project Management" },
    { value: "technical", label: "Technical" },
    { value: "admin", label: "Administrative" },
    { value: "sales", label: "Sales & Marketing" },
  ];

  const statusColors = {
    draft: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
    published: "bg-green-100 text-green-700",
    archived: "bg-red-100 text-red-700"
  };

  const statusDotColors = {
    draft: "bg-gray-300",
    published: "bg-green-500",
    archived: "bg-red-400",
  };

  const activeFilterCount =
    (categoryFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0);

  // Group SOPs by category
  const grouped = filteredSOPs.reduce((acc, sop) => {
    const cat = sop.category || "uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(sop);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Consolidated toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 px-4 h-12">
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 shrink-0">SOPs</h1>

          <div className="relative flex-1 max-w-md min-w-0 ml-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5" />
            <Input
              placeholder="Search SOPs"
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
                    onClick={() => {
                      setCategoryFilter("all");
                      setStatusFilter("all");
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>

          <div className="ml-auto">
            <Button
              onClick={() => {
                setEditingSOP(null);
                setShowDrawer(true);
              }}
              size="sm"
              className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New SOP
            </Button>
          </div>
        </div>
      </div>

      {/* SOPs list */}
      <div className="overflow-y-auto flex-1 min-h-0 bg-white dark:bg-gray-950">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">Loading…</div>
        ) : filteredSOPs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
            {searchQuery || categoryFilter !== "all" || statusFilter !== "all"
              ? "No SOPs match your filters."
              : 'No SOPs yet. Click "New SOP" to get started.'}
          </div>
        ) : (
          <>
            {categories.map((cat) => {
              const groupSops = grouped[cat.value] || [];
              if (groupSops.length === 0) return null;
              return (
                <div key={cat.value}>
                  <div className="flex items-center gap-2 px-3 h-7 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      {cat.label}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{groupSops.length}</span>
                  </div>
                  {groupSops.map((sop) => (
                    <div
                      key={sop.id}
                      className="group flex items-center gap-2 pl-3 pr-2 h-10 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      onClick={() => setViewingSOP(sop)}
                    >
                      <FileText className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />

                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${statusDotColors[sop.status] || "bg-gray-300"}`} />

                      <span className="flex-1 min-w-0 truncate text-[13px] text-gray-900 dark:text-gray-100 font-medium">
                        {sop.title}
                      </span>

                      {sop.description && (
                        <span className="hidden md:inline text-[11px] text-gray-500 shrink-0 max-w-[280px] truncate">
                          {sop.description}
                        </span>
                      )}

                      <span className="hidden lg:inline text-[11px] text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                        v{sop.version || 1}
                      </span>

                      <span className="hidden lg:inline text-[11px] text-gray-400 dark:text-gray-500 shrink-0 tabular-nums w-20 text-right">
                        {new Date(sop.created_at).toLocaleDateString()}
                      </span>

                      <Badge className={`${statusColors[sop.status]} capitalize text-[10px] shrink-0`}>
                        {sop.status}
                      </Badge>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSOP(sop);
                          setShowDrawer(true);
                        }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteDialog({ open: true, sopId: sop.id });
                        }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
            {/* Uncategorized */}
            {grouped.uncategorized?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-3 h-7 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Uncategorized
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{grouped.uncategorized.length}</span>
                </div>
                {grouped.uncategorized.map((sop) => (
                  <div
                    key={sop.id}
                    className="group flex items-center gap-2 pl-3 pr-2 h-10 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    onClick={() => setViewingSOP(sop)}
                  >
                    <FileText className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${statusDotColors[sop.status] || "bg-gray-300"}`} />
                    <span className="flex-1 min-w-0 truncate text-[13px] text-gray-900 dark:text-gray-100 font-medium">
                      {sop.title}
                    </span>
                    <Badge className={`${statusColors[sop.status]} capitalize text-[10px] shrink-0`}>
                      {sop.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* SOP Form Drawer */}
      <Sheet open={showDrawer} onOpenChange={setShowDrawer}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingSOP ? "Edit SOP" : "New SOP"}</SheetTitle>
            <SheetDescription>
              {editingSOP ? "Update standard operating procedure" : "Create a new standard operating procedure"}
            </SheetDescription>
          </SheetHeader>
          <SOPForm
            sop={editingSOP}
            categories={categories}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowDrawer(false);
              setEditingSOP(null);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* View SOP Dialog */}
      <Dialog open={!!viewingSOP} onOpenChange={(open) => !open && setViewingSOP(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className="text-2xl mb-2">{viewingSOP?.title}</DialogTitle>
                <div className="flex gap-2 mb-4">
                  <Badge variant="outline" className="capitalize">
                    {categories.find(c => c.value === viewingSOP?.category)?.label || viewingSOP?.category}
                  </Badge>
                  <Badge className={statusColors[viewingSOP?.status]}>
                    {viewingSOP?.status}
                  </Badge>
                  <Badge variant="outline">v{viewingSOP?.version || 1}</Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingSOP(viewingSOP);
                  setViewingSOP(null);
                  setShowDrawer(true);
                }}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </div>
            {viewingSOP?.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-4">{viewingSOP.description}</p>
            )}
          </DialogHeader>
          <div className="mt-4">
            <div className="bg-white dark:bg-gray-950 rounded-lg p-6 border prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: viewingSOP?.content || '' }} />
            </div>
            <div className="mt-4 pt-4 border-t text-xs text-gray-500 flex justify-between">
              <span>Created: {viewingSOP && new Date(viewingSOP.created_at).toLocaleDateString()}</span>
              {viewingSOP?.last_reviewed_date && (
                <span>Last reviewed: {new Date(viewingSOP.last_reviewed_date).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete SOP</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this SOP? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, sopId: null })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SOPForm({ sop, categories, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(sop || {
    title: "",
    description: "",
    category: "project",
    content: "",
    status: "draft",
    version: 1
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    const updatedData = { ...formData };
    if (sop && sop.content !== formData.content) {
      updatedData.version = (sop.version || 1) + 1;
    }

    onSubmit(updatedData);
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link', 'image'],
      [{ 'align': [] }],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent',
    'link', 'image',
    'align'
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Client Onboarding Process"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description || ""}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of this SOP"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status *</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content *</Label>
        <div className="border rounded-md">
          <ReactQuill
            theme="snow"
            value={formData.content}
            onChange={(content) => setFormData({ ...formData, content })}
            modules={modules}
            formats={formats}
            placeholder="Write your SOP steps and instructions here..."
            style={{ height: '300px', marginBottom: '50px' }}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-gray-900 hover:bg-gray-800 text-white">
          {sop ? "Update SOP" : "Create SOP"}
        </Button>
      </div>
    </form>
  );
}
