import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { parseLocalDate } from "@/utils";
import { Account, TeamMember } from "@/api/entities";
import { sendNotification } from "@/api/functions";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Trash2, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Check, Filter, List, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { PostStatusIcon, PostStatusPicker, PlatformChip, STATUS_LIST as POST_STATUS_LIST } from "../components/social/PostIcons";
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
  const [deleteDialog, setDeleteDialog] = useState({ open: false, postId: null });
  const [viewMode, setViewMode] = useState("list"); // list or calendar
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
    if (deleteDialog.postId) {
      const { error } = await supabase.from("social_posts").delete().eq("id", deleteDialog.postId);
      if (error) { console.error("Error deleting post:", error); return; }
      setDeleteDialog({ open: false, postId: null });
      loadData();
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
          onDelete={(id) => setDeleteDialog({ open: true, postId: id })}
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

      <Sheet open={showDrawer} onOpenChange={setShowDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingPost ? "Edit Social Post" : "New Social Post"}</SheetTitle>
            <SheetDescription>
              {editingPost ? "Update post details" : "Create a new social media post"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
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
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Social Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this social media post? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, postId: null })}
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

function PostRow({ post, accountsMap, onApprovalToggle, onStatusChange, onEdit, onDelete }) {
  const scheduled = formatScheduledDate(post.scheduled_date);
  const account = post.client_id ? accountsMap[post.client_id] : null;
  return (
    <div
      className="group flex items-center gap-2 pl-3 pr-2 h-10 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
      onClick={() => onEdit(post)}
    >
      <div className="flex items-center justify-center w-5 shrink-0" onClick={(e) => e.stopPropagation()}>
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
}

function LinearPostList({
  posts,
  allPostCount,
  accountsMap,
  onApprovalToggle,
  onStatusChange,
  onEdit,
  onDelete,
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
                  />
                ))
              ))}
          </div>
        );
      })}
    </div>
  );
}
