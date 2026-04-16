import React, { useState, useEffect } from "react";
import { TeamMember } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, Edit, UserCheck, UserX, Users, Search, Send, Loader2, Trash2, Shield, ShieldCheck, Clock } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import FormShell from "@/components/ui/FormShell";
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
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Consolidated toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 px-4 h-12">
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 shrink-0">Team</h1>

          {isAdmin && (
            <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5 text-[12px] ml-2">
              <button
                type="button"
                onClick={() => setViewTab("team")}
                className={`px-2.5 py-1 rounded ${
                  viewTab === "team"
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Members <span className="opacity-60">({teamMembers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewTab("users")}
                className={`px-2.5 py-1 rounded ${
                  viewTab === "users"
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Users <span className="opacity-60">({users.length})</span>
                {usersWithoutTeamMember.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                    {usersWithoutTeamMember.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {viewTab === "team" && (
            <div className="relative flex-1 max-w-md min-w-0 ml-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5" />
              <Input
                placeholder="Search team"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-[13px] border-gray-200 dark:border-gray-800 focus-visible:ring-1"
              />
            </div>
          )}

          {isAdmin && (
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInviteDialog(true)}
                className="h-7 px-2 text-[13px]"
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                Invite
              </Button>
              <Button
                onClick={() => {
                  setEditingMember(null);
                  setShowDrawer(true);
                }}
                size="sm"
                className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Member
              </Button>
            </div>
          )}
        </div>

        {/* Status sub-tabs (for team view) */}
        {viewTab === "team" && isAdmin && (
          <div className="flex items-center gap-5 px-4 h-9 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setStatusTab("active")}
              className={`relative h-9 text-[13px] font-medium ${
                statusTab === "active"
                  ? "text-gray-900 dark:text-gray-100 after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-gray-900"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-300"
              }`}
            >
              Active <span className="text-gray-400 dark:text-gray-500 tabular-nums ml-1">{activeMembers.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("inactive")}
              className={`relative h-9 text-[13px] font-medium ${
                statusTab === "inactive"
                  ? "text-gray-900 dark:text-gray-100 after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-gray-900"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-300"
              }`}
            >
              Inactive <span className="text-gray-400 dark:text-gray-500 tabular-nums ml-1">{inactiveMembers.length}</span>
            </button>
          </div>
        )}
      </div>

      {/* Team Members View */}
      {viewTab === "team" && (
        <div className="overflow-y-auto flex-1 min-h-0 bg-white dark:bg-gray-950">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">Loading…</div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
              {searchQuery
                ? "No team members match your search."
                : isAdmin
                  ? 'No team members yet. Click "Add Member" to get started.'
                  : "Team members will appear here."}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 px-3 h-7 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  {statusTab === "active" ? "Active members" : "Inactive members"}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{filteredMembers.length}</span>
              </div>
              {filteredMembers.map((member) => {
                const linkedUser = getUserForMember(member.user_id);
                const hasSignedIn = linkedUser?.last_sign_in_at;
                const isPending = linkedUser && !hasSignedIn;
                const statusDotColor =
                  member.status === "active"
                    ? hasSignedIn
                      ? "bg-green-500"
                      : isPending
                        ? "bg-amber-500"
                        : "bg-gray-300"
                    : "bg-gray-300";

                return (
                  <div
                    key={member.id}
                    className="group flex items-center gap-2 pl-3 pr-2 h-10 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden">
                      {member.profile_image_url ? (
                        <img
                          src={member.profile_image_url}
                          alt={member.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-semibold text-white">
                          {member.full_name?.charAt(0) || "?"}
                        </span>
                      )}
                    </div>

                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${statusDotColor}`} />

                    <span className="flex-1 min-w-0 truncate text-[13px] text-gray-900 dark:text-gray-100 font-medium">
                      {member.full_name}
                    </span>

                    {member.role && (
                      <span className="hidden md:inline capitalize text-[11px] text-gray-500 shrink-0 w-32 truncate">
                        {member.role.replace(/_/g, " ")}
                      </span>
                    )}

                    {member.email && (
                      <span className="hidden lg:inline text-[11px] text-gray-500 shrink-0 max-w-[200px] truncate">
                        {member.email}
                      </span>
                    )}

                    {member.employment_type && (
                      <span className="hidden xl:inline capitalize text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                        {member.employment_type.replace(/_/g, " ")}
                      </span>
                    )}

                    <div className="shrink-0">
                      {linkedUser ? (
                        hasSignedIn ? (
                          isAdmin && linkedUser.id !== authUser?.id ? (
                            <Select
                              value={linkedUser.role}
                              onValueChange={(value) => handleChangePortalRole(linkedUser.id, value)}
                            >
                              <SelectTrigger className="w-[110px] h-7 text-[11px] border-gray-200 dark:border-gray-800">
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
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 capitalize">
                              {linkedUser.role === "admin" ? (
                                <ShieldCheck className="w-3 h-3 text-amber-600" />
                              ) : (
                                <UserCheck className="w-3 h-3 text-green-600" />
                              )}
                              {linkedUser.role}
                            </span>
                          )
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleInviteExisting(member)}
                                className="text-[11px] text-amber-600 hover:text-amber-700 underline"
                              >
                                Resend
                              </button>
                            )}
                          </div>
                        )
                      ) : isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleInviteExisting(member)}
                          className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-300"
                        >
                          <Send className="w-3 h-3" />
                          Invite
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">No account</span>
                      )}
                    </div>

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEdit(member)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteDialog({ open: true, member })}
                          className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Users View - Admin Only */}
      {isAdmin && viewTab === "users" && (
        <div className="overflow-y-auto flex-1 min-h-0 bg-white dark:bg-gray-950">
          {usersWithoutTeamMember.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-3 h-7 bg-amber-50 border-b border-amber-200">
                <UserX className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-amber-800">
                  Needs team profile
                </span>
                <span className="text-[11px] text-amber-600 tabular-nums">{usersWithoutTeamMember.length}</span>
              </div>
              {usersWithoutTeamMember.map((user) => (
                <div
                  key={user.id}
                  className="group flex items-center gap-2 pl-3 pr-2 h-10 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-white">
                      {user.full_name?.charAt(0) || "?"}
                    </span>
                  </div>
                  <span className="flex-1 min-w-0 truncate text-[13px] text-gray-900 dark:text-gray-100 font-medium">
                    {user.full_name}
                  </span>
                  <span className="hidden md:inline text-[11px] text-gray-500 truncate max-w-[240px]">
                    {user.email}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleCreateFromUser(user)}
                    className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Create profile
                  </Button>
                </div>
              ))}
            </>
          )}

          <div className="flex items-center gap-2 px-3 h-7 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              All users
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{users.length}</span>
          </div>
          {users.map((user) => {
            const teamMember = getMemberForUser(user.id);
            return (
              <div
                key={user.id}
                className="group flex items-center gap-2 pl-3 pr-2 h-10 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-white">
                    {user.full_name?.charAt(0) || "?"}
                  </span>
                </div>
                <span className="flex-1 min-w-0 truncate text-[13px] text-gray-900 dark:text-gray-100 font-medium">
                  {user.full_name}
                </span>
                <span className="hidden md:inline text-[11px] text-gray-500 truncate max-w-[240px]">
                  {user.email}
                </span>
                <span className="hidden lg:inline-flex items-center gap-1 capitalize text-[11px] text-gray-500 shrink-0">
                  {user.role === "admin" ? (
                    <ShieldCheck className="w-3 h-3 text-amber-600" />
                  ) : (
                    <Shield className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                  )}
                  {user.role}
                </span>
                {teamMember ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-green-600 shrink-0">
                    <UserCheck className="w-3 h-3" />
                    {teamMember.role?.replace(/_/g, " ")}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCreateFromUser(user)}
                    className="h-7 px-2 text-[13px]"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Create
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <FormShell
        open={showDrawer}
        onOpenChange={setShowDrawer}
        storageKey="hdo.teamMemberForm.viewMode"
        title={editingMember ? "Edit Team Member" : "Add Team Member"}
        description={editingMember ? "Update team member details" : "Add a new team member with role and bio"}
      >
        <TeamMemberForm
          teamMember={editingMember}
          users={users}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowDrawer(false);
            setEditingMember(null);
          }}
        />
      </FormShell>

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
              className="bg-gray-900 hover:bg-gray-800 text-white"
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
              className="bg-gray-900 hover:bg-gray-800 text-white"
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
