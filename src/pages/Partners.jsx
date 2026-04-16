import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Edit, Search } from "lucide-react";

export default function Partners() {
  const { userProfile, invitePartner } = useAuth();
  const [partners, setPartners] = useState([]);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({ totalPartners: 0, activeReferrals: 0, totalPaid: 0, pendingPayouts: 0 });
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
      const [partnersRes, projectsRes, payoutsRes] = await Promise.all([
        supabase
          .from("referral_partners")
          .select(`
            *,
            referrals(id, status, client_name, projects(name))
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("projects")
          .select("id, name, status, billing_type")
          .in("billing_type", ["retainer", "exit"])
          .eq("status", "active"),
        supabase
          .from("referral_payouts")
          .select("amount, status"),
      ]);

      const partnersData = partnersRes.data || [];
      setPartners(partnersData);
      setProjects(projectsRes.data || []);

      // Calculate stats
      const payouts = payoutsRes.data || [];
      const activeReferrals = partnersData.reduce((sum, p) =>
        sum + (p.referrals?.filter(r => r.status === "active").length || 0), 0);
      const totalPaid = payouts
        .filter(p => p.status === "paid")
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      const pendingPayouts = payouts
        .filter(p => p.status === "pending")
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      setStats({
        totalPartners: partnersData.filter(p => p.status === "active").length,
        activeReferrals,
        totalPaid,
        pendingPayouts,
      });
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
      const { error } = await supabase
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
      if (error) throw error;

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
      const { error } = await supabase.from("referrals").insert({
        partner_id: selectedPartner.id,
        project_id: referralData.project_id,
        commission_rate: referralData.commission_rate,
        commission_months: referralData.commission_months,
        status: "active",
      });
      if (error) throw error;

      setReferralDialog(false);
      setSelectedPartner(null);
      setReferralData({ project_id: "", commission_rate: 15, commission_months: 6 });
      loadData();
    } catch (error) {
      console.error("Error adding referral:", error);
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

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center">
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Admin Access Required
          </h2>
          <p className="text-[13px] text-gray-500">
            You need administrator privileges to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Consolidated toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 px-4 h-12">
          <span className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Partners</span>

          <div className="relative flex-1 max-w-md min-w-0 ml-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5" />
            <Input
              placeholder="Search partners"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-[13px] border-gray-200 dark:border-gray-800 focus-visible:ring-1"
            />
          </div>

          <div className="ml-auto">
            <Button
              onClick={() => setInviteDialog(true)}
              className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Invite Partner
            </Button>
          </div>
        </div>

        {/* Metric pill strip */}
        <div className="flex items-center gap-5 px-4 h-9 border-t border-gray-100 dark:border-gray-800">
          <span className="text-[13px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Active partners
            <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{stats.totalPartners}</span>
          </span>
          <span className="text-[13px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Active referrals
            <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{stats.activeReferrals}</span>
          </span>
          <span className="text-[13px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Total paid
            <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">${stats.totalPaid.toLocaleString()}</span>
          </span>
          <span className="text-[13px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pending payouts
            <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">${stats.pendingPayouts.toLocaleString()}</span>
          </span>
          <span className="text-[12px] text-gray-400 dark:text-gray-500 ml-auto tabular-nums">
            {filteredPartners.length} {filteredPartners.length === 1 ? "partner" : "partners"}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 min-h-0 bg-white dark:bg-gray-950">
        {loading ? (
          <div className="p-8 text-center text-[13px] text-gray-400 dark:text-gray-500">Loading…</div>
        ) : filteredPartners.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-gray-400 dark:text-gray-500">
            <p>No partners yet</p>
            <p className="text-[12px]">Invite your first partner to get started</p>
          </div>
        ) : (
          <>
            <div className="h-7 flex items-center px-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                All partners
              </span>
              <span className="ml-2 text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                {filteredPartners.length}
              </span>
            </div>
            {filteredPartners.map((partner) => {
              const activeRefs = partner.referrals?.filter(r => r.status === "active").length || 0;
              const pendingRefs = partner.referrals?.filter(r => r.status === "pending").length || 0;
              const isActive = partner.status === "active";

              return (
                <div
                  key={partner.id}
                  className="group flex items-center gap-3 px-3 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <div className="w-6 h-6 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex items-center justify-center text-[10px] font-medium">
                    {getInitials(partner.contact_name)}
                  </div>

                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium truncate">
                      {partner.contact_name}
                    </span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isActive ? "bg-green-500" : "bg-gray-300"
                      }`}
                      title={partner.status}
                    />
                    {partner.company_name && (
                      <span className="text-[12px] text-gray-500 truncate">
                        {partner.company_name}
                      </span>
                    )}
                  </div>

                  <span className="hidden md:inline text-[12px] text-gray-500 truncate max-w-[200px]">
                    {partner.email}
                  </span>

                  <span className="hidden lg:inline text-[12px] text-gray-500 shrink-0 tabular-nums w-24 text-right">
                    {partner.commission_rate}% · {partner.commission_months}mo
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0 w-32 justify-end">
                    <span className="text-[12px] text-gray-900 dark:text-gray-100 tabular-nums">
                      {activeRefs} active
                    </span>
                    {pendingRefs > 0 && (
                      <span className="text-[11px] text-amber-600 tabular-nums">
                        · {pendingRefs} pipeline
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPartner(partner);
                        setReferralDialog(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100"
                      title="Link project"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingPartner({ ...partner });
                      setEditSheet(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100"
                    title="Edit"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

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
              className="bg-gray-900 hover:bg-gray-800 text-white"
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
                <Button
                  onClick={handleUpdatePartner}
                  className="bg-gray-900 hover:bg-gray-800 text-white"
                >
                  Save Changes
                </Button>
              </div>

              {/* Partner's Referrals */}
              {editingPartner.referrals?.length > 0 && (
                <div className="pt-6 border-t">
                  <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">
                    Referrals
                  </div>
                  <div className="mt-2">
                    {editingPartner.referrals.map((ref) => {
                      const dotColor =
                        ref.status === "active"
                          ? "bg-green-500"
                          : ref.status === "pending"
                          ? "bg-amber-500"
                          : "bg-gray-300";
                      return (
                        <div
                          key={ref.id}
                          className="flex items-center gap-2 px-2 py-2 border-b border-gray-100 dark:border-gray-800 text-[13px]"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                          <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
                            {ref.projects?.name || ref.client_name || "Pending"}
                          </span>
                          <span className="text-[12px] text-gray-500 capitalize">
                            {ref.status}
                          </span>
                        </div>
                      );
                    })}
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
            <DialogTitle>Link Project to Partner</DialogTitle>
            <DialogDescription>
              Manually link a project to {selectedPartner?.contact_name} for commission tracking.
              Note: Referrals from the CRM are linked automatically when won.
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
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              Link Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
