import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { Account, TeamMember } from "@/api/entities";
import { sendNotification } from "@/api/functions";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Search, Trash2, ChevronLeft, ChevronRight, Check, Target, Trophy, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toWeekStart } from "@/config/kpiConfig";
import { saveEntries } from "@/api/kpiCalculations";
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

  // KPI state
  const [kpiEntries, setKpiEntries] = useState([]);
  const [showKpiSettings, setShowKpiSettings] = useState(false);
  const [kpiMember, setKpiMember] = useState(null);
  const [kpiWeeklyGoal, setKpiWeeklyGoal] = useState(0);
  const [kpiBonus, setKpiBonus] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentWeekStart = toWeekStart(new Date());
      const [postsRes, accountsData, teamMembersData, kpiRes] = await Promise.all([
        supabase.from("social_posts").select("*").order("scheduled_date", { ascending: false }),
        Account.list(),
        TeamMember.list(),
        supabase.from("kpi_entries").select("*").eq("slug", "social_posts").eq("month", currentWeekStart).not("team_member_id", "is", null),
      ]);
      setSocialPosts(postsRes.data || []);
      setAccounts(accountsData);
      setTeamMembers(teamMembersData.filter(m => m.status === "active"));
      setKpiEntries(kpiRes.data || []);
    } catch (error) {
      console.error("Error loading social media:", error);
    } finally {
      setLoading(false);
    }
  };

  // KPI stats from kpi_entries (same data as KPI page)
  const kpiStats = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekStartStr = toWeekStart(today);
    const startOfWeek = new Date(weekStartStr + "T00:00:00");

    return teamMembers
      .map(member => {
        const kpiEntry = kpiEntries.find(e => e.team_member_id === member.id);
        const weeklyGoal = kpiEntry ? Number(kpiEntry.target_value) || 0 : 0;
        const bonusAmount = kpiEntry ? Number(kpiEntry.bonus_amount) || 0 : 0;

        if (weeklyGoal <= 0) return null;

        const dailyGoal = Math.ceil(weeklyGoal / 5);
        // Count published posts assigned to this member
        const memberPosts = socialPosts.filter(p => p.assigned_to === member.id && p.status === "published");
        const todayCount = memberPosts.filter(p => new Date(p.scheduled_date) >= startOfDay).length;
        const weekCount = memberPosts.filter(p => new Date(p.scheduled_date) >= startOfWeek).length;

        const dailyProgress = dailyGoal > 0 ? (todayCount / dailyGoal) * 100 : 0;
        const weeklyProgress = weeklyGoal > 0 ? (weekCount / weeklyGoal) * 100 : 0;
        const dayOfWeek = today.getDay();
        const workingDaysPassed = dayOfWeek === 0 ? 5 : Math.min(dayOfWeek, 5);
        const expectedProgress = (workingDaysPassed / 5) * 100;
        const onTrackForBonus = weeklyProgress >= 100 || weeklyProgress >= expectedProgress;

        return {
          ...member,
          todayCount,
          weekCount,
          dailyGoal,
          weeklyGoal,
          bonusAmount,
          dailyProgress: Math.min(dailyProgress, 100),
          weeklyProgress: Math.min(weeklyProgress, 100),
          onTrackForBonus,
        };
      })
      .filter(Boolean);
  }, [teamMembers, socialPosts, kpiEntries]);

  const handleSaveKpi = async () => {
    if (!kpiMember) return;
    const currentWeekStart = toWeekStart(new Date());
    const existingStat = kpiStats.find(s => s.id === kpiMember.id);

    await saveEntries([{
      slug: "social_posts",
      month: currentWeekStart,
      actual_value: existingStat?.weekCount || 0,
      target_value: kpiWeeklyGoal,
      bonus_amount: kpiBonus || null,
      team_member_id: kpiMember.id,
    }]);

    setShowKpiSettings(false);
    setKpiMember(null);
    loadData();
  };

  const openKpiSettings = (member) => {
    setKpiMember(member);
    const kpiEntry = kpiEntries.find(e => e.team_member_id === member.id);
    const weeklyGoal = kpiEntry ? Number(kpiEntry.target_value) || 0 : 0;
    setKpiWeeklyGoal(weeklyGoal);
    setKpiBonus(kpiEntry ? Number(kpiEntry.bonus_amount) || 0 : 0);
    setShowKpiSettings(true);
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
    if (editingPost) {
      await supabase.from("social_posts").update(postData).eq("id", editingPost.id);
      await notifyAdmins({
        title: "Social post updated",
        message: `Post updated: ${postData.title || "Untitled"}`,
        source: "social.post_updated",
      });
    } else {
      await supabase.from("social_posts").insert(postData);
      await notifyAdmins({
        title: "New social post created",
        message: `${postData.title || "Untitled"} scheduled for ${postData.scheduled_date || "TBD"}`,
        source: "social.post_created",
      });
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

      {/* KPI Dashboard */}
      {kpiStats.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-pink-600" />
              Team KPIs
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kpiStats.map(member => (
              <Card key={member.id} className={`${member.onTrackForBonus ? 'border-green-300 bg-green-50/50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{member.full_name}</span>
                      {member.onTrackForBonus && (
                        <Trophy className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openKpiSettings(member)}>
                      <Settings className="w-3 h-3 text-gray-400" />
                    </Button>
                  </div>

                  {/* Daily Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Today</span>
                      <span className="font-medium">{member.todayCount} / {member.dailyGoal}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${member.dailyProgress >= 100 ? 'bg-green-500' : 'bg-pink-500'}`}
                        style={{ width: `${member.dailyProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Weekly Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">This Week</span>
                      <span className="font-medium">{member.weekCount} / {member.weeklyGoal}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${member.weeklyProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${member.weeklyProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Bonus Info */}
                  {member.bonusAmount > 0 && (
                    <div className={`text-xs px-2 py-1 rounded-full text-center ${member.onTrackForBonus ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {member.onTrackForBonus ? '\u2713 On track for' : 'Goal:'} ${member.bonusAmount} bonus
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Add KPI Card */}
            <Card className="border-dashed border-2 border-gray-200 hover:border-gray-300 cursor-pointer" onClick={() => {
              const membersWithoutKpi = teamMembers.filter(tm => !kpiEntries.find(e => e.team_member_id === tm.id));
              if (membersWithoutKpi.length > 0) {
                openKpiSettings(membersWithoutKpi[0]);
              }
            }}>
              <CardContent className="p-4 flex items-center justify-center h-full min-h-[140px]">
                <div className="text-center text-gray-400">
                  <Plus className="w-6 h-6 mx-auto mb-1" />
                  <span className="text-sm">Set Team KPIs</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Setup prompt if no KPIs */}
      {kpiStats.length === 0 && teamMembers.length > 0 && !loading && (
        <Card className="mb-6 bg-pink-50 border-pink-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-pink-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Set Up Team KPIs</h3>
                  <p className="text-sm text-gray-600">Track weekly posting goals with bonus incentives</p>
                </div>
              </div>
              <Button onClick={() => openKpiSettings(teamMembers[0])}>
                Configure
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                      <div className="flex items-center gap-3">
                        {post.image_url && (
                          <img
                            src={post.image_url}
                            alt=""
                            className="w-10 h-10 rounded object-cover shrink-0"
                            onError={(e) => { e.target.style.display = "none"; }}
                          />
                        )}
                        <div className="min-w-0">
                          <span className="font-medium">{post.title}</span>
                          <p className="text-xs text-gray-500 truncate max-w-xs">{post.content}</p>
                          {post.hashtags && (
                            <p className="text-xs text-indigo-500 truncate max-w-xs">{post.hashtags}</p>
                          )}
                        </div>
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

      {/* KPI Settings Sheet */}
      <Sheet open={showKpiSettings} onOpenChange={setShowKpiSettings}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Set Posting Goals</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select value={kpiMember?.id || ""} onValueChange={(id) => {
                const member = teamMembers.find(m => m.id === id);
                if (member) {
                  setKpiMember(member);
                  const entry = kpiEntries.find(e => e.team_member_id === id);
                  const wg = entry ? Number(entry.target_value) || 0 : 0;
                  setKpiWeeklyGoal(wg);
                  setKpiBonus(entry ? Number(entry.bonus_amount) || 0 : 0);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Weekly Goal (posts per week)</Label>
              <Input
                type="number"
                value={kpiWeeklyGoal}
                onChange={(e) => setKpiWeeklyGoal(parseInt(e.target.value) || 0)}
                placeholder="e.g., 5"
              />
              <p className="text-xs text-gray-500">
                Daily target: {kpiWeeklyGoal > 0 ? Math.ceil(kpiWeeklyGoal / 5) : 0} per day (weekly / 5)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Bonus Amount ($)</Label>
              <Input
                type="number"
                value={kpiBonus}
                onChange={(e) => setKpiBonus(parseFloat(e.target.value) || 0)}
                placeholder="e.g., 50"
              />
              <p className="text-xs text-gray-500">Bonus earned when weekly goal is met</p>
            </div>

            <Button className="w-full" onClick={handleSaveKpi} disabled={!kpiMember}>
              Save KPI Settings
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
