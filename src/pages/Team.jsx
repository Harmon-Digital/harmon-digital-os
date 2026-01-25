import React, { useState, useEffect } from "react";
import { TeamMember } from "@/api/entities";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Mail, UserCheck, UserX, Users, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import TeamMemberForm from "../components/team/TeamMemberForm";

export default function Team() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [viewTab, setViewTab] = useState("team");
  const [syncDialog, setSyncDialog] = useState({ open: false, user: null });
  const [statusTab, setStatusTab] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);
      
      const [membersData, usersData] = await Promise.all([
        TeamMember.list("-created_date"),
        User.list()
      ]);
      
      setTeamMembers(membersData);
      setUsers(usersData);
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

  const getUserForMember = (userId) => {
    return users.find(u => u.id === userId);
  };

  const getMemberForUser = (userId) => {
    return teamMembers.find(tm => tm.user_id === userId);
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

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 mt-1">Meet the team members</p>
        </div>
        {isAdmin && (
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
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Active Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{activeMembers.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Synced with Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {teamMembers.filter(tm => tm.user_id).length}
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <UserX className="w-4 h-4" />
                Users Without Team Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {usersWithoutTeamMember.length}
              </div>
            </CardContent>
          </Card>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">Loading...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchQuery ? "No team members found" : "No team members yet"}
                </h3>
                <p className="text-gray-500">
                  {searchQuery ? "Try adjusting your search" : isAdmin ? "Click \"Add Team Member\" to get started" : "Team members will appear here"}
                </p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const linkedUser = getUserForMember(member.user_id);
                return (
                  <Card key={member.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                          {member.profile_image_url ? (
                            <img 
                              src={member.profile_image_url} 
                              alt={member.full_name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl font-bold text-white">
                              {member.full_name?.charAt(0) || '?'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1 truncate">
                            {member.full_name}
                          </h3>
                          <Badge className={roleColors[member.role]}>
                            {member.role.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>

                      {member.bio && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                          {member.bio}
                        </p>
                      )}

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{member.email}</span>
                        </div>
                        {linkedUser && (
                          <div className="flex items-center gap-2 text-sm">
                            <UserCheck className="w-4 h-4 text-green-600" />
                            <span className="text-green-600">User account linked</span>
                          </div>
                        )}
                      </div>

                      {member.skills && member.skills.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {member.skills.map((skill, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {isAdmin && (
                        <div className="pt-4 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(member)}
                            className="w-full"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Profile
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
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
    </div>
  );
}