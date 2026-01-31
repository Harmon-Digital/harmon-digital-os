import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Mail, Users, Search, Clock, Check, X } from "lucide-react";

export default function Partners() {
  const { userProfile, invitePartner } = useAuth();
  const [partners, setPartners] = useState([]);
  const [projects, setProjects] = useState([]);
  const [pendingReferrals, setPendingReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Invite dialog
  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: "",
    contactName: "",
    companyName: "",
  });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Edit sheet
  const [editSheet, setEditSheet] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);

  // Add referral dialog
  const [referralDialog, setReferralDialog] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [referralData, setReferralData] = useState({
    project_id: "",
    commission_rate: 15,
    commission_months: 6,
  });

  const isAdmin = userProfile?.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [partnersRes, projectsRes, pendingRes] = await Promise.all([
        supabase
          .from("referral_partners")
          .select("*, referrals(id, projects(name))")
          .order("created_at", { ascending: false }),
        supabase
          .from("projects")
          .select("id, name, status, billing_type")
          .in("billing_type", ["retainer", "exit"])
          .eq("status", "active"),
        supabase
          .from("referrals")
          .select("*, referral_partners(contact_name, company_name, email)")
          .eq("status", "pending")
          .order("submitted_at", { ascending: false }),
      ]);

      setPartners(partnersRes.data || []);
      setProjects(projectsRes.data || []);
      setPendingReferrals(pendingRes.data || []);
    } catch (error) {
      console.error("Error loading partners:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    setInviting(true);
    setInviteError("");

    try {
      await invitePartner(
        inviteData.email,
        inviteData.contactName,
        inviteData.companyName
      );
      setInviteDialog(false);
      setInviteData({ email: "", contactName: "", companyName: "" });
      loadData();
    } catch (error) {
      setInviteError(error.message || "Failed to invite partner");
    } finally {
      setInviting(false);
    }
  };

  const handleUpdatePartner = async () => {
    if (!editingPartner) return;

    try {
      await supabase
        .from("referral_partners")
        .update({
          contact_name: editingPartner.contact_name,
          company_name: editingPartner.company_name,
          phone: editingPartner.phone,
          commission_rate: editingPartner.commission_rate,
          commission_months: editingPartner.commission_months,
          status: editingPartner.status,
          notes: editingPartner.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingPartner.id);

      setEditSheet(false);
      setEditingPartner(null);
      loadData();
    } catch (error) {
      console.error("Error updating partner:", error);
    }
  };

  const handleAddReferral = async () => {
    if (!selectedPartner || !referralData.project_id) return;

    try {
      await supabase.from("referrals").insert({
        partner_id: selectedPartner.id,
        project_id: referralData.project_id,
        commission_rate: referralData.commission_rate,
        commission_months: referralData.commission_months,
      });

      setReferralDialog(false);
      setSelectedPartner(null);
      setReferralData({ project_id: "", commission_rate: 15, commission_months: 6 });
      loadData();
    } catch (error) {
      console.error("Error adding referral:", error);
    }
  };

  const handleApproveReferral = async (referralId, projectId) => {
    try {
      await supabase
        .from("referrals")
        .update({
          status: "active",
          project_id: projectId || null,
        })
        .eq("id", referralId);
      loadData();
    } catch (error) {
      console.error("Error approving referral:", error);
    }
  };

  const handleRejectReferral = async (referralId) => {
    try {
      await supabase
        .from("referrals")
        .update({ status: "cancelled" })
        .eq("id", referralId);
      loadData();
    } catch (error) {
      console.error("Error rejecting referral:", error);
    }
  };

  const filteredPartners = partners.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.contact_name?.toLowerCase().includes(query) ||
      p.company_name?.toLowerCase().includes(query) ||
      p.email?.toLowerCase().includes(query)
    );
  });

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Admin Access Required
          </h2>
          <p className="text-gray-500">
            You need administrator privileges to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partners</h1>
          <p className="text-gray-500">Manage referral partners and commissions</p>
        </div>
        <Button
          onClick={() => setInviteDialog(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Invite Partner
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search partners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <span className="text-sm text-gray-500">
          {filteredPartners.length} partner{filteredPartners.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Pending Referrals */}
      {pendingReferrals.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-0">
            <div className="p-4 border-b border-amber-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="font-medium text-amber-900">
                Pending Referrals ({pendingReferrals.length})
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Link to Project</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingReferrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {referral.referral_partners?.contact_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {referral.referral_partners?.company_name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{referral.client_name}</div>
                        {referral.client_company && (
                          <div className="text-sm text-gray-500">
                            {referral.client_company}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{referral.client_email}</div>
                        {referral.client_phone && (
                          <div className="text-gray-500">{referral.client_phone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="text-sm text-gray-600 truncate">
                        {referral.notes || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-500">
                        {referral.submitted_at
                          ? new Date(referral.submitted_at).toLocaleDateString()
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        onValueChange={(value) =>
                          handleApproveReferral(referral.id, value)
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApproveReferral(referral.id, null)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          title="Approve without project"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRejectReferral(referral.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Partners Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No partners yet</p>
              <p className="text-sm">Invite your first partner to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Referrals</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{partner.contact_name}</div>
                        {partner.company_name && (
                          <div className="text-sm text-gray-500">
                            {partner.company_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{partner.email}</TableCell>
                    <TableCell>
                      {partner.commission_rate}% / {partner.commission_months}mo
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{partner.referrals?.length || 0}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPartner(partner);
                            setReferralDialog(true);
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          partner.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {partner.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPartner({ ...partner });
                          setEditSheet(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Partner</DialogTitle>
            <DialogDescription>
              Send an invitation email to a new referral partner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {inviteError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {inviteError}
              </div>
            )}
            <div className="space-y-2">
              <Label>Contact Name *</Label>
              <Input
                value={inviteData.contactName}
                onChange={(e) =>
                  setInviteData({ ...inviteData, contactName: e.target.value })
                }
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={inviteData.email}
                onChange={(e) =>
                  setInviteData({ ...inviteData, email: e.target.value })
                }
                placeholder="john@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={inviteData.companyName}
                onChange={(e) =>
                  setInviteData({ ...inviteData, companyName: e.target.value })
                }
                placeholder="Company LLC"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteData.email || !inviteData.contactName}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {inviting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sheet */}
      <Sheet open={editSheet} onOpenChange={setEditSheet}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Partner</SheetTitle>
            <SheetDescription>Update partner details and commission terms</SheetDescription>
          </SheetHeader>
          {editingPartner && (
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  value={editingPartner.contact_name}
                  onChange={(e) =>
                    setEditingPartner({
                      ...editingPartner,
                      contact_name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  value={editingPartner.company_name || ""}
                  onChange={(e) =>
                    setEditingPartner({
                      ...editingPartner,
                      company_name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editingPartner.phone || ""}
                  onChange={(e) =>
                    setEditingPartner({
                      ...editingPartner,
                      phone: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Commission Rate (%)</Label>
                  <Input
                    type="number"
                    value={editingPartner.commission_rate}
                    onChange={(e) =>
                      setEditingPartner({
                        ...editingPartner,
                        commission_rate: parseFloat(e.target.value) || 15,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Commission Months</Label>
                  <Input
                    type="number"
                    value={editingPartner.commission_months}
                    onChange={(e) =>
                      setEditingPartner({
                        ...editingPartner,
                        commission_months: parseInt(e.target.value) || 6,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingPartner.status}
                  onValueChange={(value) =>
                    setEditingPartner({ ...editingPartner, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={editingPartner.notes || ""}
                  onChange={(e) =>
                    setEditingPartner({
                      ...editingPartner,
                      notes: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditSheet(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdatePartner}>Save Changes</Button>
              </div>

              {/* Partner's Referrals */}
              {editingPartner.referrals?.length > 0 && (
                <div className="pt-6 border-t">
                  <h4 className="font-medium mb-3">Referrals</h4>
                  <div className="space-y-2">
                    {editingPartner.referrals.map((ref) => (
                      <div
                        key={ref.id}
                        className="text-sm p-2 bg-gray-50 rounded"
                      >
                        {ref.projects?.name || "Unknown Project"}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Referral Dialog */}
      <Dialog open={referralDialog} onOpenChange={setReferralDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Referral</DialogTitle>
            <DialogDescription>
              Link a project to {selectedPartner?.contact_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select
                value={referralData.project_id}
                onValueChange={(value) =>
                  setReferralData({ ...referralData, project_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.billing_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Commission Rate (%)</Label>
                <Input
                  type="number"
                  value={referralData.commission_rate}
                  onChange={(e) =>
                    setReferralData({
                      ...referralData,
                      commission_rate: parseFloat(e.target.value) || 15,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Commission Months</Label>
                <Input
                  type="number"
                  value={referralData.commission_months}
                  onChange={(e) =>
                    setReferralData({
                      ...referralData,
                      commission_months: parseInt(e.target.value) || 6,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferralDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddReferral}
              disabled={!referralData.project_id}
            >
              Add Referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
