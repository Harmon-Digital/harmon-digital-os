import React, { useState, useEffect } from "react";
import { SocialPost, Account, TeamMember } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Calendar, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [postsData, accountsData, teamMembersData] = await Promise.all([
        SocialPost.list("-scheduled_date"),
        Account.list(),
        TeamMember.list()
      ]);
      setSocialPosts(postsData);
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
      await SocialPost.update(editingPost.id, postData);
    } else {
      await SocialPost.create(postData);
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
      await SocialPost.delete(deleteDialog.postId);
      setDeleteDialog({ open: false, postId: null });
      loadData();
    }
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
    linkedin: "🔗",
    twitter: "🐦",
    facebook: "📘",
    instagram: "📷"
  };

  const draftPosts = filteredPosts.filter(p => p.status === 'draft');
  const scheduledPosts = filteredPosts.filter(p => p.status === 'scheduled');
  const publishedPosts = filteredPosts.filter(p => p.status === 'published');

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{draftPosts.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{scheduledPosts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{publishedPosts.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
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
            <SelectTrigger>
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
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Content Preview</TableHead>
              <TableHead>Platforms</TableHead>
              <TableHead>Scheduled Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredPosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  {socialPosts.length === 0 ? "No posts yet. Click \"New Post\" to get started." : "No posts match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filteredPosts.map((post) => (
                <TableRow key={post.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-gray-600 truncate">{post.content}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {post.platforms?.map((platform) => (
                        <span key={platform} className="text-lg" title={platform}>
                          {platformIcons[platform]}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {new Date(post.scheduled_date).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {post.client_id ? getAccountName(post.client_id) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {post.assigned_to ? getTeamMemberName(post.assigned_to) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[post.status]}>
                      {post.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
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