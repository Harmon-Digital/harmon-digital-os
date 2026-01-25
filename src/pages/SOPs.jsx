
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, FileText, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      const sopsData = await base44.entities.SOP.list("-created_date");
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
        await base44.entities.SOP.update(editingSOP.id, sopData);
      } else {
        await base44.entities.SOP.create(sopData);
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
      await base44.entities.SOP.delete(deleteDialog.sopId);
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
    draft: "bg-gray-100 text-gray-700",
    published: "bg-green-100 text-green-700",
    archived: "bg-red-100 text-red-700"
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Standard Operating Procedures</h1>
          <p className="text-gray-500 mt-1">Document and manage your processes</p>
        </div>
        <Button 
          onClick={() => {
            setEditingSOP(null);
            setShowDrawer(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New SOP
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search SOPs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SOPs Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading SOPs...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSOPs.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No SOPs Found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery || categoryFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters" 
                  : "Get started by creating your first SOP"}
              </p>
            </div>
          ) : (
            filteredSOPs.map((sop) => (
              <Card 
                key={sop.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setViewingSOP(sop)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base mb-2 truncate">{sop.title}</CardTitle>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" className="capitalize">
                            {categories.find(c => c.value === sop.category)?.label || sop.category}
                          </Badge>
                          <Badge className={statusColors[sop.status]}>
                            {sop.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{sop.description || "No description"}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      v{sop.version || 1} • {new Date(sop.created_date).toLocaleDateString()}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSOP(sop);
                          setShowDrawer(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteDialog({ open: true, sopId: sop.id });
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

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
              <p className="text-gray-600 mb-4">{viewingSOP.description}</p>
            )}
          </DialogHeader>
          <div className="mt-4">
            <div className="bg-white rounded-lg p-6 border prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: viewingSOP?.content || '' }} />
            </div>
            <div className="mt-4 pt-4 border-t text-xs text-gray-500 flex justify-between">
              <span>Created: {viewingSOP && new Date(viewingSOP.created_date).toLocaleDateString()}</span>
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
    
    // Increment version if editing and content changed
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
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {sop ? "Update SOP" : "Create SOP"}
        </Button>
      </div>
    </form>
  );
}
