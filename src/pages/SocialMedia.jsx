import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { parseLocalDate } from "@/utils";
import { Account, TeamMember } from "@/api/entities";
import { sendNotification } from "@/api/functions";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Trash2, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Check, Filter, List, Calendar as CalendarIcon, Kanban, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { PostStatusIcon, PostStatusPicker, PlatformChip, STATUS_LIST as POST_STATUS_LIST } from "../components/social/PostIcons";
import FormShell from "@/components/ui/FormShell";
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
import SocialPostForm from "../components/social/SocialPostForm";
import { toast } from "@/lib/toast";

export default function SocialMedia() {
  const { user } = useAuth();
  const [socialPosts, setSocialPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState({ open: false, postIds: [] });
  const [viewMode, setViewMode] = useState("list"); // list or calendar
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedPostIds, setSelectedPostIds] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [postsRes, accountsData, teamMembersData] = await Promise.all([
        supabase.from("social_posts").select("*").order("scheduled_date", { ascending: false }),
        Account.list(),
        TeamMember.list(),
      ]);
      setSocialPosts(postsRes.data || []);
      setAccounts(accountsData);
      setTeamMembers(teamMembersData.filter(m => m.status === "active"));
    } catch (error) {
      console.error("Error loading social media:", error);
    } finally {
      setLoading(false);
    }
  };

  const notifyAdmins = async ({ title, message, link = "/SocialMedia", priority = "normal", source = "social.update" }) => {
    const { data: admins } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("role", "admin");

    if (!admins?.length) return;

    await Promise.all(
      admins
        .filter(a => a.id !== user?.id)
        .map((admin) => sendNotification({
          userId: admin.id,
          type: "info",
          category: "social",
          priority,
          source,
          title,
          message,
          link,
        }))
    );
  };

  const handleSubmit = async (postData) => {
    try {
      if (editingPost) {
        const { error } = await supabase.from("social_posts").update(postData).eq("id", editingPost.id);
        if (error) throw error;
        await notifyAdmins({
          title: "Social post updated",
          message: `Post updated: ${postData.title || "Untitled"}`,
          source: "social.post_updated",
        });
      } else {
        const { error } = await supabase.from("social_posts").insert(postData);
        if (error) throw error;
        await notifyAdmins({
          title: "New social post created",
          message: `${postData.title || "Untitled"} scheduled for ${postData.scheduled_date || "TBD"}`,
          source: "social.post_created",
        });
      }
      setShowDrawer(false);
      setEditingPost(null);
      loadData();
    } catch (error) {
      console.error("Error saving social post:", error);
      toast.error("Couldn't save post", { description: error.message });
    }
  };

  const handleEdit = (post) => {
    setEditingPost(post);
    setShowDrawer(true);
  };

  const handleDelete = async () => {
    const ids = deleteDialog.postIds?.length
      ? deleteDialog.postIds
      : deleteDialog.postId ? [deleteDialog.postId] : [];
    if (!ids.length) return;
    try {
      const { error } = await supabase.from("social_posts").delete().in("id", ids);
      if (error) throw error;
      setDeleteDialog({ open: false, postIds: [] });
      setSelectedPostIds((prev) => prev.filter((id) => !ids.includes(id)));
      loadData();
      toast.success(`${ids.length} post${ids.length === 1 ? "" : "s"} deleted`);
    } catch (err) {
      toast.error("Couldn't delete", { description: err.message });
    }
  };

  const handleBulkStatusChange = async (newStatus, idsOverride) => {
    const ids = idsOverride || selectedPostIds;
    if (!ids.length) return;
    try {
      const { error } = await supabase.from("social_posts").update({ status: newStatus }).in("id", ids);
      if (error) throw error;
      setSocialPosts((prev) => prev.map((p) => ids.includes(p.id) ? { ...p, status: newStatus } : p));
      if (!idsOverride) setSelectedPostIds([]);
      toast.success(`${ids.length} post${ids.length === 1 ? "" : "s"} updated`);
    } catch (err) {
      toast.error("Couldn't update", { description: err.message });
    }
  };

  const handleBulkApproval = async (approved, idsOverride) => {
    const ids = idsOverride || selectedPostIds;
    if (!ids.length) return;
    try {
      const { error } = await supabase.from("social_posts").update({ approved }).in("id", ids);
      if (error) throw error;
      setSocialPosts((prev) => prev.map((p) => ids.includes(p.id) ? { ...p, approved } : p));
      if (!idsOverride) setSelectedPostIds([]);
      toast.success(`${ids.length} post${ids.length === 1 ? "" : "s"} ${approved ? "approved" : "unapproved"}`);
    } catch (err) {
      toast.error("Couldn't update", { description: err.message });
    }
  };

  const handleStatusChange = async (postId, newStatus) => {
    const { error } = await supabase.from("social_posts").update({ status: newStatus }).eq("id", postId);
    if (error) { console.error("Error updating post status:", error); return; }
    const post = socialPosts.find(p => p.id === postId);

    if (newStatus === "published") {
      await notifyAdmins({
        title: "Social post published",
        message: `Published: ${post?.title || "Untitled"}`,
        source: "social.post_published",
      });
    }

    setSocialPosts(prev => prev.map(p => p.id === postId ? { ...p, status: newStatus } : p));
  };

  const handleApprovalToggle = async (postId, currentApproved) => {
    const newApproved = !currentApproved;
    const { error } = await supabase.from("social_posts").update({ approved: newApproved }).eq("id", postId);
    if (error) { console.error("Error toggling approval:", error); return; }
    setSocialPosts(prev => prev.map(p => p.id === postId ? { ...p, approved: newApproved } : p));
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.company_name || "";
  };

  const getTeamMemberName = (teamMemberId) => {
    const member = teamMembers.find(tm => tm.id === teamMemberId);
    return member?.full_name || "Unassigned";
  };

  const accountsMap = useMemo(() => {
    const m = {};
    for (const a of accounts || []) m[a.id] = a;
    return m;
  }, [accounts]);

  const handleAutoSave = async (postData) => {
    if (!editingPost?.id) return;
    try {
      const { data: saved, error } = await supabase
        .from("social_posts")
        .update(postData)
        .eq("id", editingPost.id)
        .select()
        .single();
      if (error) throw error;
      setEditingPost((prev) => (prev ? { ...prev, ...saved } : prev));
      setSocialPosts((prev) => prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)));
    } catch (err) {
      console.error("Auto-save failed:", err);
      throw err;
    }
  };

  const filteredPosts = socialPosts.filter(post => {
    const matchesSearch = searchQuery === "" ||
      post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || post.status === statusFilter;
    const matchesPlatform = platformFilter === "all" || post.platforms?.includes(platformFilter);

    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const statusColors = {
    draft: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
    scheduled: "bg-blue-100 text-blue-800",
    published: "bg-green-100 text-green-800"
  };

  const platformIcons = {
    linkedin: "in",
    twitter: "X",
    facebook: "f",
    instagram: "ig"
  };

  // Calendar logic
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // Add empty slots for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const calendarDays = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

  const getPostsForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return filteredPosts.filter(post => post.scheduled_date === dateStr);
  };

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  // Post status counts for inline strip
  const postCounts = useMemo(() => {
    const counts = { total: socialPosts.length, draft: 0, scheduled: 0, published: 0, approved: 0 };
    for (const p of socialPosts) {
      if (p.status === "draft") counts.draft++;
      else if (p.status === "scheduled") counts.scheduled++;
      else if (p.status === "published") counts.published++;
      if (p.approved) counts.approved++;
    }
    return counts;
  }, [socialPosts]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      <div className="overflow-y-auto flex-1 min-h-0">
      {/* Inline metric strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 lg:px-6 py-3 text-[13px] text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          Total <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{postCounts.total}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          Draft <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{postCounts.draft}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Scheduled <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{postCounts.scheduled}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Published <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{postCounts.published}</span>
        </span>
        <span className="flex items-center gap-1.5">
          Approved <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{postCounts.approved}</span>
        </span>
      </div>

      {/* Consolidated toolbar */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-950 border-y border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 px-4 h-12">
          <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5 text-[12px]">
            {[
              { id: "all", label: "All" },
              { id: "draft", label: "Draft" },
              { id: "scheduled", label: "Scheduled" },
              { id: "published", label: "Published" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatusFilter(s.id)}
                className={`px-2.5 py-1 rounded ${
                  statusFilter === s.id
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5" />
            <Input
              placeholder="Search posts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-[13px] border-gray-200 dark:border-gray-800 focus-visible:ring-1"
            />
          </div>

          {(() => {
            const filterCount = platformFilter !== "all" ? 1 : 0;
            return (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5 h-8 text-[13px]">
                    <Filter className="w-3.5 h-3.5" />
                    Filter
                    {filterCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold">
                        {filterCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Filters</span>
                    {filterCount > 0 && (
                      <button
                        type="button"
                        className="text-xs text-indigo-600 hover:text-indigo-700"
                        onClick={() => setPlatformFilter("all")}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Platform</label>
                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
                      <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Platforms</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="twitter">Twitter</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
            );
          })()}

          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-1 rounded ${viewMode === "list" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                title="List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("board")}
                className={`p-1 rounded ${viewMode === "board" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                title="Board"
              >
                <Kanban className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`p-1 rounded ${viewMode === "calendar" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                title="Calendar"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <Button
              onClick={() => {
                setEditingPost(null);
                setShowDrawer(true);
              }}
              size="sm"
              className="bg-gray-900 hover:bg-gray-800 text-white h-8 shrink-0 text-[13px]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New post
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-gray-200 dark:border-gray-800 border-t-gray-400 rounded-full animate-spin" />
        </div>
      ) : viewMode === "list" ? (
        <LinearPostList
          posts={filteredPosts}
          allPostCount={socialPosts.length}
          accountsMap={accountsMap}
          onApprovalToggle={handleApprovalToggle}
          onStatusChange={handleStatusChange}
          onEdit={handleEdit}
          onDelete={(id) => setDeleteDialog({ open: true, postIds: [id] })}
          selectedIds={selectedPostIds}
          onToggleSelect={(id) =>
            setSelectedPostIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
          onBulkStatusChange={handleBulkStatusChange}
          onBulkApproval={handleBulkApproval}
          onBulkDelete={(ids) => setDeleteDialog({ open: true, postIds: ids })}
        />
      ) : viewMode === "board" ? (
        <BoardView
          posts={filteredPosts}
          accountsMap={accountsMap}
          onStatusChange={handleStatusChange}
          onEdit={handleEdit}
          onApprovalToggle={handleApprovalToggle}
        />
      ) : (
        <div className="p-4 lg:p-6">
          {/* Calendar header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-100 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{monthName}</h2>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-100 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-white dark:bg-gray-950 px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-gray-500">
                {day}
              </div>
            ))}
            {calendarDays.map((day, idx) => {
              const postsForDay = getPostsForDate(day);
              const isToday = day && day.toDateString() === new Date().toDateString();
              return (
                <div
                  key={idx}
                  className={`min-h-[96px] p-1.5 ${day ? 'bg-white dark:bg-gray-950' : 'bg-gray-50 dark:bg-gray-900'}`}
                >
                  {day && (
                    <>
                      <div className={`text-[12px] font-medium mb-1 tabular-nums ${isToday ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
                        {isToday ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-900 text-white text-[11px]">{day.getDate()}</span> : day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {postsForDay.slice(0, 3).map(post => {
                          const dot =
                            post.status === 'published' ? 'bg-green-500' :
                            post.status === 'scheduled' ? 'bg-blue-500' : 'bg-gray-300';
                          return (
                            <div
                              key={post.id}
                              onClick={() => handleEdit(post)}
                              className="text-[11px] px-1 py-0.5 rounded truncate cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 text-gray-700 dark:text-gray-300"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                              {post.approved && <Check className="w-3 h-3 text-green-600 flex-shrink-0" />}
                              <span className="truncate">{post.title}</span>
                            </div>
                          );
                        })}
                        {postsForDay.length > 3 && (
                          <div className="text-[11px] text-gray-400 dark:text-gray-500 px-1">
                            +{postsForDay.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>

      {/* Bulk action bar (shown when posts are selected) */}
      {selectedPostIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white rounded-md shadow-lg px-3 py-2 z-50">
          <div className="flex items-center gap-3 text-[13px]">
            <span className="font-medium tabular-nums">{selectedPostIds.length} selected</span>
            <div className="w-px h-4 bg-gray-700" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="text-gray-300 hover:text-white text-[13px]">Status</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {POST_STATUS_LIST.map((s) => (
                  <DropdownMenuItem key={s.id} onClick={() => handleBulkStatusChange(s.id)}>
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => handleBulkApproval(true)}
              className="text-gray-300 hover:text-green-400 text-[13px]"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => handleBulkApproval(false)}
              className="text-gray-300 hover:text-white text-[13px]"
            >
              Unapprove
            </button>
            <button
              type="button"
              onClick={() => setDeleteDialog({ open: true, postIds: selectedPostIds })}
              className="text-gray-300 hover:text-red-400 text-[13px]"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedPostIds([])}
              className="ml-1 p-0.5 text-gray-400 hover:text-white rounded hover:bg-gray-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <FormShell
        open={showDrawer}
        onOpenChange={setShowDrawer}
        storageKey="hdo.socialPostForm.viewMode"
        title={editingPost ? "Edit Social Post" : "New Social Post"}
        description={editingPost ? "Update post details" : "Create a new social media post"}
      >
        <SocialPostForm
          socialPost={editingPost}
          accounts={accounts}
          teamMembers={teamMembers}
          onSubmit={handleSubmit}
          onAutoSave={handleAutoSave}
          onCancel={() => {
            setShowDrawer(false);
            setEditingPost(null);
          }}
        />
      </FormShell>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {deleteDialog.postIds?.length > 1 ? `${deleteDialog.postIds.length} posts` : "post"}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteDialog.postIds?.length > 1 ? `these ${deleteDialog.postIds.length} posts` : "this post"}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, postIds: [] })}
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

/* ---------- Kanban board view ---------- */

const BOARD_COLUMNS = [
  { id: "draft", label: "Draft", dot: "bg-gray-400" },
  { id: "scheduled", label: "Scheduled", dot: "bg-blue-500" },
  { id: "published", label: "Published", dot: "bg-green-500" },
];

function BoardView({ posts, accountsMap, onStatusChange, onEdit, onApprovalToggle }) {
  const grouped = React.useMemo(() => {
    const m = { draft: [], scheduled: [], published: [] };
    for (const p of posts) {
      const k = p.status in m ? p.status : "draft";
      m[k].push(p);
    }
    // Sort scheduled by date asc, others by created_at desc
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => {
        if (k === "scheduled") {
          return (a.scheduled_date || "").localeCompare(b.scheduled_date || "");
        }
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
    }
    return m;
  }, [posts]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId;
    const sourceStatus = result.source.droppableId;
    if (newStatus === sourceStatus) return;
    onStatusChange(result.draggableId, newStatus);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="h-full overflow-x-auto">
        <div className="inline-flex h-full gap-3 px-4 py-3 min-w-full">
          {BOARD_COLUMNS.map((col) => {
            const columnPosts = grouped[col.id] || [];
            return (
              <div key={col.id} className="flex-shrink-0 w-72 flex flex-col">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300">{col.label}</span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{columnPosts.length}</span>
                </div>
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-md transition-colors ${
                        snapshot.isDraggingOver ? "bg-gray-100 dark:bg-gray-800" : "bg-gray-50/50 dark:bg-gray-900/50"
                      } p-1.5 overflow-y-auto`}
                    >
                      <div className="space-y-1.5">
                        {columnPosts.map((post, index) => {
                          const scheduled = formatScheduledDate(post.scheduled_date);
                          const account = post.client_id ? accountsMap[post.client_id] : null;
                          return (
                            <Draggable key={post.id} draggableId={post.id} index={index}>
                              {(prov, snap) => (
                                <div
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  {...prov.dragHandleProps}
                                  className={`bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md p-2.5 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-all ${
                                    snap.isDragging ? "shadow-lg ring-1 ring-gray-300 dark:ring-gray-700" : ""
                                  }`}
                                  onClick={() => onEdit(post)}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[13px] text-gray-900 dark:text-gray-100 font-medium line-clamp-2">
                                        {post.title || "Untitled post"}
                                      </div>
                                    </div>
                                    {post.approved && (
                                      <span title="Approved" className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400">
                                        <Check className="w-2.5 h-2.5" />
                                      </span>
                                    )}
                                  </div>

                                  {post.platforms?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {post.platforms.map((p) => (
                                        <PlatformChip key={p} platform={p} />
                                      ))}
                                    </div>
                                  )}

                                  {(scheduled || account) && (
                                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-500 dark:text-gray-500">
                                      {scheduled && (
                                        <span className={scheduled.late ? "text-red-600" : ""}>{scheduled.label}</span>
                                      )}
                                      {scheduled && account && <span className="text-gray-300 dark:text-gray-600">·</span>}
                                      {account && (
                                        <span className="truncate">{account.company_name}</span>
                                      )}
                                    </div>
                                  )}

                                  {post.body && (
                                    <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-1.5 line-clamp-2">
                                      {post.body}
                                    </p>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        {columnPosts.length === 0 && (
                          <div className="text-center py-6 text-[12px] text-gray-400 dark:text-gray-500">
                            No posts
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
  );
}

/* ---------- Linear-style post list ---------- */

function formatScheduledDate(iso) {
  if (!iso) return null;
  const d = parseLocalDate(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const postStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((postStart - startOfToday) / (1000 * 60 * 60 * 24));
  if (days === 0) return { label: "Today", late: false };
  if (days === 1) return { label: "Tomorrow", late: false };
  if (days === -1) return { label: "Yesterday", late: true };
  if (days > 1 && days <= 6)
    return { label: d.toLocaleDateString(undefined, { weekday: "short" }), late: false };
  return {
    label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    late: days < 0,
  };
}

function PostRow({
  post,
  accountsMap,
  onApprovalToggle,
  onStatusChange,
  onEdit,
  onDelete,
  selectedIds = [],
  onToggleSelect,
  onBulkStatusChange,
  onBulkApproval,
  onBulkDelete,
}) {
  const scheduled = formatScheduledDate(post.scheduled_date);
  const account = post.client_id ? accountsMap[post.client_id] : null;
  const isSelected = selectedIds.includes(post.id);
  const multi = isSelected && selectedIds.length > 1;
  const targetIds = multi ? selectedIds : [post.id];
  const targetLabel = multi ? `${selectedIds.length} posts` : "post";

  const rowContent = (
    <div
      className={`group flex items-center gap-2 pl-3 pr-2 h-10 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
        isSelected ? "bg-indigo-50/40 dark:bg-indigo-900/20" : ""
      }`}
      onClick={() => onEdit(post)}
    >
      {/* Selection checkbox — hidden until row hover, visible when selected */}
      {onToggleSelect && (
        <div
          className="flex items-center justify-center w-5 shrink-0 opacity-0 group-hover:opacity-100 data-[checked=true]:opacity-100 transition-opacity"
          data-checked={isSelected}
          onClick={(e) => e.stopPropagation()}
          title="Select"
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(post.id)}
          />
        </div>
      )}

      {/* Approval checkbox */}
      <div
        className="flex items-center justify-center w-5 shrink-0 opacity-0 group-hover:opacity-100 data-[checked=true]:opacity-100 transition-opacity"
        data-checked={post.approved || false}
        onClick={(e) => e.stopPropagation()}
        title={post.approved ? "Approved" : "Approve"}
      >
        <Checkbox
          checked={post.approved || false}
          onCheckedChange={() => onApprovalToggle(post.id, post.approved)}
        />
      </div>

      <PostStatusPicker value={post.status} onChange={(v) => onStatusChange(post.id, v)}>
        <PostStatusIcon status={post.status} size={14} />
      </PostStatusPicker>

      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          className="w-7 h-7 rounded object-cover shrink-0"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
      )}

      <span className="flex-1 min-w-0 truncate text-[13px] text-gray-900 dark:text-gray-100 font-medium">
        {post.title}
        {post.content && (
          <span className="ml-2 text-gray-400 dark:text-gray-500 font-normal">{post.content.slice(0, 60)}</span>
        )}
      </span>

      <div className="hidden md:flex items-center gap-0.5 shrink-0">
        {post.platforms?.map((p) => (
          <PlatformChip key={p} platform={p} />
        ))}
      </div>

      {scheduled && (
        <span
          className={`hidden md:inline-flex items-center gap-1 text-[11px] shrink-0 tabular-nums ${
            scheduled.late ? "text-red-600" : "text-gray-500"
          }`}
        >
          <CalendarIcon className="w-3 h-3" />
          {scheduled.label}
        </span>
      )}

      {account && (
        <span className="hidden lg:inline-flex max-w-[140px] text-[11px] text-gray-500 truncate shrink-0">
          {account.company_name}
        </span>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(post.id);
        }}
        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={() => onEdit(post)} className="text-[13px]">
          Open
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger className="text-[13px]">
            Change status{multi ? ` · ${targetLabel}` : ""}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {POST_STATUS_LIST.map((s) => (
              <ContextMenuItem
                key={s.id}
                onClick={() => {
                  if (multi) onBulkStatusChange?.(s.id, targetIds);
                  else onStatusChange(post.id, s.id);
                }}
                className="text-[13px]"
              >
                {s.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem
          onClick={() => {
            if (multi) onBulkApproval?.(true, targetIds);
            else onApprovalToggle(post.id, post.approved);
          }}
          className="text-[13px]"
        >
          {multi ? `Approve ${targetLabel}` : post.approved ? "Unapprove" : "Approve"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            if (multi) onBulkDelete?.(targetIds);
            else onDelete(post.id);
          }}
          className="text-[13px] text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950/40"
        >
          Delete {multi ? `${targetLabel}` : "post"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function LinearPostList({
  posts,
  allPostCount,
  accountsMap,
  onApprovalToggle,
  onStatusChange,
  onEdit,
  onDelete,
  selectedIds,
  onToggleSelect,
  onBulkStatusChange,
  onBulkApproval,
  onBulkDelete,
}) {
  const [collapsed, setCollapsed] = React.useState(() => new Set());
  const toggleGroup = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const grouped = React.useMemo(() => {
    const m = new Map();
    for (const s of POST_STATUS_LIST) m.set(s.id, []);
    for (const p of posts) {
      if (m.has(p.status)) m.get(p.status).push(p);
    }
    return m;
  }, [posts]);

  if (posts.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
        {allPostCount === 0
          ? 'No posts yet. Click "New Post" to get started.'
          : "No posts match your filters."}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-950">
      {POST_STATUS_LIST.map((s) => {
        const groupPosts = grouped.get(s.id) || [];
        const isCollapsed = collapsed.has(s.id);
        return (
          <div key={s.id}>
            <button
              type="button"
              onClick={() => toggleGroup(s.id)}
              className="w-full flex items-center gap-2 px-3 h-8 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronRightIcon
                className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
              />
              <PostStatusIcon status={s.id} size={12} />
              <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300">{s.label}</span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{groupPosts.length}</span>
            </button>
            {!isCollapsed &&
              (groupPosts.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-gray-400 dark:text-gray-500 italic border-b border-gray-100 dark:border-gray-800">
                  No posts
                </div>
              ) : (
                groupPosts.map((post) => (
                  <PostRow
                    key={post.id}
                    post={post}
                    accountsMap={accountsMap}
                    onApprovalToggle={onApprovalToggle}
                    onStatusChange={onStatusChange}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    selectedIds={selectedIds}
                    onToggleSelect={onToggleSelect}
                    onBulkStatusChange={onBulkStatusChange}
                    onBulkApproval={onBulkApproval}
                    onBulkDelete={onBulkDelete}
                  />
                ))
              ))}
          </div>
        );
      })}
    </div>
  );
}
