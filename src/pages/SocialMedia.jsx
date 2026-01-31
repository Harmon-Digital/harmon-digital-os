import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { Account, TeamMember } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Search, Trash2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SocialPostForm from "../components/social/SocialPostForm";

export default function SocialMedia() {
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
        TeamMember.list()
      ]);
      setSocialPosts(postsRes.data || []);
      setAccounts(accountsData);
      setTeamMembers(teamMembersData);
    } catch (error) {
      console.error("Error loading social media:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (postData) => {
    if (editingPost) {
      await supabase.from("social_posts").update(postData).eq("id", editingPost.id);
    } else {
      await supabase.from("social_posts").insert(postData);
    }
    setShowDrawer(false);
    setEditingPost(null);
    loadData();
  };

  const handleEdit = (post) => {
    setEditingPost(post);
    setShowDrawer(true);
  };

  const handleDelete = async () => {
    if (deleteDialog.postId) {
      await supabase.from("social_posts").delete().eq("id", deleteDialog.postId);
      setDeleteDialog({ open: false, postId: null });
      loadData();
    }
  };

  const handleStatusChange = async (postId, newStatus) => {
    await supabase.from("social_posts").update({ status: newStatus }).eq("id", postId);
    setSocialPosts(prev => prev.map(p => p.id === postId ? { ...p, status: newStatus } : p));
  };

  const handleApprovalToggle = async (postId, currentApproved) => {
    const newApproved = !currentApproved;
    await supabase.from("social_posts").update({ approved: newApproved }).eq("id", postId);
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

  const filteredPosts = socialPosts.filter(post => {
    const matchesSearch = searchQuery === "" ||
      post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || post.status === statusFilter;
    const matchesPlatform = platformFilter === "all" || post.platforms?.includes(platformFilter);

    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const statusColors = {
    draft: "bg-gray-100 text-gray-800",
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

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Social Media</h1>
          <p className="text-gray-500 mt-1">Plan and schedule social media content</p>
        </div>
        <Button
          onClick={() => {
            setEditingPost(null);
            setShowDrawer(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Post
        </Button>
      </div>

      {/* View Toggle + Filters */}
      <div className="flex items-center gap-4 mb-6">
        <Tabs value={viewMode} onValueChange={setViewMode}>
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1" />

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>

        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="twitter">Twitter</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        </div>
      ) : viewMode === "list" ? (
        /* List View */
        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">OK</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    {socialPosts.length === 0 ? "No posts yet. Click \"New Post\" to get started." : "No posts match your filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPosts.map((post) => (
                  <TableRow key={post.id} className="hover:bg-gray-50">
                    <TableCell>
                      <Checkbox
                        checked={post.approved || false}
                        onCheckedChange={() => handleApprovalToggle(post.id, post.approved)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{post.title}</span>
                        <p className="text-xs text-gray-500 truncate max-w-xs">{post.content}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {post.platforms?.map((platform) => (
                          <span
                            key={platform}
                            className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium"
                            title={platform}
                          >
                            {platformIcons[platform]}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {post.scheduled_date ? new Date(post.scheduled_date).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {post.client_id ? getAccountName(post.client_id) : "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={post.status}
                        onValueChange={(val) => handleStatusChange(post.id, val)}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(post)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, postId: post.id })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-white rounded-lg border shadow-sm p-4">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold">{monthName}</h2>
            <Button variant="ghost" size="sm" onClick={() => navigateMonth(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-600">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {calendarDays.map((day, idx) => {
              const postsForDay = getPostsForDate(day);
              const isToday = day && day.toDateString() === new Date().toDateString();

              return (
                <div
                  key={idx}
                  className={`bg-white min-h-[100px] p-2 ${!day ? 'bg-gray-50' : ''}`}
                >
                  {day && (
                    <>
                      <div className={`text-sm font-medium mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-1">
                        {postsForDay.slice(0, 3).map(post => (
                          <div
                            key={post.id}
                            onClick={() => handleEdit(post)}
                            className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 flex items-center gap-1 ${
                              post.status === 'published'
                                ? 'bg-green-100 text-green-800'
                                : post.status === 'scheduled'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {post.approved && <Check className="w-3 h-3" />}
                            {post.title}
                          </div>
                        ))}
                        {postsForDay.length > 3 && (
                          <div className="text-xs text-gray-500">
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
