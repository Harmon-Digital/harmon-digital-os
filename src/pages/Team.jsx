import React, { useState, useEffect } from "react";
import { TeamMember } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Mail, UserCheck, UserX, Users, Search, Send, Loader2, Trash2, Shield, ShieldCheck, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TeamMemberForm from "../components/team/TeamMemberForm";

export default function Team() {
  const { user: authUser, userProfile } = useAuth();
  const [teamMembers, setTeamMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState("team");
  const [syncDialog, setSyncDialog] = useState({ open: false, user: null });
  const [statusTab, setStatusTab] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");

  // Invite dialog
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteData, setInviteData] = useState({ email: "", full_name: "", role: "member" });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState({ open: false, member: null });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [membersData, { data: usersData }] = await Promise.all([
        TeamMember.list("-created_at"),
        supabase.from("user_profiles").select("*").order("created_at", { ascending: false })
      ]);

      setTeamMembers(membersData);
      setUsers(usersData || []);
    } catch (error) {
      console.error("Error loading team:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (memberData) => {
    if (editingMember) {
      await TeamMember.update(editingMember.id, memberData);
    } else {
      // Check if team member with this email already exists
      if (memberData.email) {
        const { data: existing } = await supabase
          .from("team_members")
          .select("id")
          .eq("email", memberData.email)
          .limit(1);

        if (existing?.length > 0) {
          alert("A team member with this email already exists");
          return;
        }
      }
      await TeamMember.create(memberData);
    }
    setShowDrawer(false);
    setEditingMember(null);
    loadData();
  };

  const handleEdit = (member) => {
    setEditingMember(member);
    setShowDrawer(true);
  };

  const handleCreateFromUser = (user) => {
    setSyncDialog({ open: true, user });
  };

  const handleConfirmSync = async () => {
    if (syncDialog.user) {
      const newMember = {
        user_id: syncDialog.user.id,
        full_name: syncDialog.user.full_name,
        email: syncDialog.user.email,
        role: "developer",
        employment_type: "full_time",
        status: "active",
        hourly_rate: 0,
        skills: [],
        bio: ""
      };
      await TeamMember.create(newMember);
      setSyncDialog({ open: false, user: null });
      loadData();
    }
  };

  const handleInvite = async () => {
    if (!inviteData.email || !inviteData.full_name) return;

    setInviting(true);
    setInviteError("");

    try {
      const { data: result, error } = await supabase.functions.invoke("invite-team-member", {
        body: inviteData,
      });

      if (error) {
        setInviteError(error.message || "Failed to send invite");
        return;
      }

      if (result?.error) {
        setInviteError(result.error);
        return;
      }

      // Edge function + database trigger handle everything:
      // - Creates auth user
      // - Creates user_profile (with invited_at)
      // - Trigger links/creates team_member
      // Just reload data to see the changes

      setShowInviteDialog(false);
      setInviteData({ email: "", full_name: "", role: "member" });
      loadData();
      alert(result.resent ? `Invitation resent to ${inviteData.email}!` : `Invitation sent to ${inviteData.email}!`);
    } catch (error) {
      console.error("Invite error:", error);
      setInviteError("Failed to send invite. Please try again.");
    } finally {
      setInviting(false);
    }
  };

  // Invite existing team member (who doesn't have a login account yet)
  const handleInviteExisting = async (member) => {
    if (!member.email) {
      alert("This team member doesn't have an email address. Please edit their profile first.");
      return;
    }

    if (!confirm(`Send login invitation to ${member.full_name} (${member.email})?`)) {
      return;
    }

    try {
      const { data: result, error } = await supabase.functions.invoke("invite-team-member", {
        body: {
          email: member.email,
          full_name: member.full_name,
          role: "member",
        },
      });

      if (error) {
        alert(error.message || "Failed to send invite");
        return;
      }

      if (result?.error) {
        alert(result.error);
        return;
      }

      // Edge function handles linking team_member to user
      // Just reload to see updated status
      loadData();
      alert(result.resent ? `Invitation resent to ${member.email}!` : `Invitation sent to ${member.email}!`);
    } catch (error) {
      console.error("Invite error:", error);
      alert("Failed to send invite. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.member) return;

    setDeleting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("delete-team-member", {
        body: {
          team_member_id: deleteDialog.member.id,
          user_id: deleteDialog.member.user_id || null,
        },
      });

      if (error) {
        alert(error.message || "Failed to delete team member");
        return;
      }

      if (result?.error) {
        alert(result.error);
        return;
      }

      setDeleteDialog({ open: false, member: null });
      loadData();
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete team member. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const getUserForMember = (userId) => {
    return users.find(u => u.id === userId);
  };

  const getMemberForUser = (userId) => {
    return teamMembers.find(tm => tm.user_id === userId);
  };

  const handleChangePortalRole = async (userId, newRole) => {
    if (!userId) return;

    // Prevent changing own role
    if (userId === authUser?.id) {
      alert("You cannot change your own admin status");
      return;
    }

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      loadData();
    } catch (error) {
      console.error("Error changing role:", error);
      alert("Failed to change portal role");
    }
  };

  const usersWithoutTeamMember = users.filter(user => !getMemberForUser(user.id));

  const roleColors = {
    developer: "bg-blue-100 text-blue-800",
    designer: "bg-purple-100 text-purple-800",
    project_manager: "bg-green-100 text-green-800",
    marketing: "bg-orange-100 text-orange-800",
    sales: "bg-pink-100 text-pink-800"
  };

  const activeMembers = teamMembers.filter(tm => tm.status === 'active');
  const inactiveMembers = teamMembers.filter(tm => tm.status === 'inactive');

  const displayMembers = statusTab === "active" ? activeMembers : inactiveMembers;

  const filteredMembers = displayMembers.filter(member => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query) ||
      member.role?.toLowerCase().includes(query) ||
      member.bio?.toLowerCase().includes(query)
    );
  });

  const isAdmin = userProfile?.role === "admin";

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 mt-1">Meet the team members</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(true)}
            >
              <Send className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
            <Button
              onClick={() => {
                setEditingMember(null);
                setShowDrawer(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Team Member
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      {isAdmin && (
        <Tabs value={viewTab} onValueChange={setViewTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="team">Team Members</TabsTrigger>
            <TabsTrigger value="users">
              All Users
              {usersWithoutTeamMember.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {usersWithoutTeamMember.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Team Members View */}
      {viewTab === "team" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <Tabs value={statusTab} onValueChange={setStatusTab}>
              <TabsList>
                <TabsTrigger value="active">
                  Active Members
                  <Badge variant="secondary" className="ml-2">{activeMembers.length}</Badge>
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="inactive">
                    Inactive Members
                    <Badge variant="secondary" className="ml-2">{inactiveMembers.length}</Badge>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">Loading...</p>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {searchQuery ? "No team members found" : "No team members yet"}
                  </h3>
                  <p className="text-gray-500">
                    {searchQuery ? "Try adjusting your search" : isAdmin ? "Click \"Add Team Member\" to get started" : "Team members will appear here"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Account</TableHead>
                      {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => {
                      const linkedUser = getUserForMember(member.user_id);
                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                                {member.profile_image_url ? (
                                  <img
                                    src={member.profile_image_url}
                                    alt={member.full_name}
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="text-sm font-bold text-white">
                                    {member.full_name?.charAt(0) || '?'}
                                  </span>
                                )}
                              </div>
                              <span className="font-medium">{member.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={roleColors[member.role]}>
                              {member.role?.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-600">{member.email}</TableCell>
                          <TableCell>
                            <span className="text-gray-600 capitalize">
                              {member.employment_type?.replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell>
                            {linkedUser ? (
                              // User has an account - check if they've signed in
                              linkedUser.last_sign_in_at ? (
                                // Active user - show role dropdown
                                isAdmin && linkedUser.id !== authUser?.id ? (
                                  <Select
                                    value={linkedUser.role}
                                    onValueChange={(value) => handleChangePortalRole(linkedUser.id, value)}
                                  >
                                    <SelectTrigger className="w-[130px] h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">
                                        <div className="flex items-center gap-2">
                                          <ShieldCheck className="w-3 h-3 text-amber-600" />
                                          Admin
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="member">
                                        <div className="flex items-center gap-2">
                                          <UserCheck className="w-3 h-3 text-green-600" />
                                          Member
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="viewer">
                                        <div className="flex items-center gap-2">
                                          <Shield className="w-3 h-3 text-gray-500" />
                                          Viewer
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    {linkedUser.role === 'admin' ? (
                                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                                    ) : (
                                      <UserCheck className="w-4 h-4 text-green-600" />
                                    )}
                                    <span className="text-sm capitalize">{linkedUser.role}</span>
                                  </div>
                                )
                              ) : (
                                // Invited but hasn't signed in yet
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Pending
                                  </Badge>
                                </div>
                              )
                            ) : isAdmin ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleInviteExisting(member)}
                                className="h-7 text-xs"
                              >
                                <Send className="w-3 h-3 mr-1" />
                                Invite
                              </Button>
                            ) : (
                              <span className="text-gray-400">No account</span>
                            )}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(member)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteDialog({ open: true, member })}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Users View - Admin Only */}
      {isAdmin && viewTab === "users" && (
        <div className="space-y-6">
          {usersWithoutTeamMember.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-orange-900 flex items-center gap-2">
                  <UserX className="w-5 h-5" />
                  Users Without Team Profiles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-orange-700 mb-4">
                  These users can log in but don't have team member profiles yet. Create profiles to show them on the team page.
                </p>
                <div className="space-y-2">
                  {usersWithoutTeamMember.map(user => (
                    <div key={user.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                      <div>
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleCreateFromUser(user)}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Team Profile
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {users.map(user => {
                  const teamMember = getMemberForUser(user.id);
                  return (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-lg font-bold text-white">
                            {user.full_name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                        {teamMember ? (
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-gray-600">{teamMember.role}</span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateFromUser(user)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Create Profile
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Sheet open={showDrawer} onOpenChange={setShowDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingMember ? "Edit Team Member" : "Add Team Member"}</SheetTitle>
            <SheetDescription>
              {editingMember ? "Update team member details" : "Add a new team member with role and bio"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <TeamMemberForm
              teamMember={editingMember}
              users={users}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowDrawer(false);
                setEditingMember(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={syncDialog.open} onOpenChange={(open) => setSyncDialog({ ...syncDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team Profile</DialogTitle>
            <DialogDescription>
              Create a team member profile for <strong>{syncDialog.user?.full_name}</strong>?
              <br /><br />
              This will allow you to:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Display them on the team page</li>
                <li>Assign tasks to them</li>
                <li>Track their time entries</li>
                <li>Set their role and skills</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSyncDialog({ open: false, user: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSync}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Create Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Team Member Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an email invitation for them to join the team. They'll receive a link to set up their password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                placeholder="John Smith"
                value={inviteData.full_name}
                onChange={(e) => setInviteData({ ...inviteData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Portal Access</Label>
              <Select
                value={inviteData.role}
                onValueChange={(value) => setInviteData({ ...inviteData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (Full access)</SelectItem>
                  <SelectItem value="member">Member (Limited access)</SelectItem>
                  <SelectItem value="viewer">Viewer (Read only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteError && (
              <p className="text-sm text-red-600">{inviteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowInviteDialog(false);
                setInviteData({ email: "", full_name: "", role: "member" });
                setInviteError("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteData.email || !inviteData.full_name}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {inviting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.member?.full_name}</strong>?
              <br /><br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1 text-red-600">
                {deleteDialog.member?.user_id && (
                  <li>Remove their portal login access</li>
                )}
                <li>Delete their team member profile</li>
                <li>Remove them from all assigned tasks</li>
              </ul>
              <br />
              <strong className="text-red-600">This action cannot be undone.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, member: null })}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Member
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}