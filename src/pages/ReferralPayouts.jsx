import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, DollarSign, Check } from "lucide-react";

export default function ReferralPayouts() {
  const { userProfile } = useAuth();
  const [payouts, setPayouts] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedIds, setSelectedIds] = useState([]);

  // Generate payouts dialog
  const [generateDialog, setGenerateDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPayouts, setGeneratedPayouts] = useState([]);

  // Mark paid dialog
  const [markPaidDialog, setMarkPaidDialog] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");

  const isAdmin = userProfile?.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [payoutsRes, referralsRes] = await Promise.all([
        supabase
          .from("referral_payouts")
          .select(`
            *,
            referrals(
              commission_rate,
              commission_months,
              partner_id,
              referral_partners(contact_name, company_name),
              projects(name, monthly_retainer, billing_type)
            )
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("referrals")
          .select(`
            *,
            referral_partners(contact_name, company_name, email),
            projects(name, monthly_retainer, billing_type, valuation_percentage, success_fee_status)
          `)
          .eq("status", "active"),
      ]);

      setPayouts(payoutsRes.data || []);
      setReferrals(referralsRes.data || []);
    } catch (error) {
      console.error("Error loading payouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyPayouts = async () => {
    setGenerating(true);
    try {
      const currentMonth = new Date();
      const periodStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const periodEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const newPayouts = [];

      for (const referral of referrals) {
        // Check if payout already exists for this month
        const existingPayout = payouts.find(
          (p) =>
            p.referral_id === referral.id &&
            p.payout_type === "retainer" &&
            new Date(p.period_start).getMonth() === periodStart.getMonth() &&
            new Date(p.period_start).getFullYear() === periodStart.getFullYear()
        );

        if (existingPayout) continue;

        // Count existing retainer payouts
        const retainerPayouts = payouts.filter(
          (p) => p.referral_id === referral.id && p.payout_type === "retainer"
        );

        if (retainerPayouts.length >= referral.commission_months) continue;

        // Calculate commission
        const monthlyRetainer = referral.projects?.monthly_retainer || 0;
        const rate = referral.commission_rate || 15;
        const amount = monthlyRetainer * (rate / 100);

        if (amount > 0) {
          newPayouts.push({
            referral_id: referral.id,
            amount,
            payout_type: "retainer",
            period_start: periodStart.toISOString().split("T")[0],
            period_end: periodEnd.toISOString().split("T")[0],
            status: "pending",
          });
        }
      }

      setGeneratedPayouts(newPayouts);
    } catch (error) {
      console.error("Error generating payouts:", error);
    } finally {
      setGenerating(false);
    }
  };

  const confirmGeneratePayouts = async () => {
    try {
      if (generatedPayouts.length > 0) {
        await supabase.from("referral_payouts").insert(generatedPayouts);
      }
      setGenerateDialog(false);
      setGeneratedPayouts([]);
      loadData();
    } catch (error) {
      console.error("Error saving payouts:", error);
    }
  };

  const handleMarkPaid = async () => {
    try {
      await supabase
        .from("referral_payouts")
        .update({
          status: "paid",
          paid_date: new Date().toISOString().split("T")[0],
          payment_reference: paymentReference,
        })
        .in("id", selectedIds);

      setMarkPaidDialog(false);
      setPaymentReference("");
      setSelectedIds([]);
      loadData();
    } catch (error) {
      console.error("Error marking paid:", error);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredPayouts = payouts.filter((p) => {
    if (statusFilter === "all") return true;
    return p.status === statusFilter;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPayouts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPayouts.map((p) => p.id));
    }
  };

  const totalPending = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const statusColors = {
    pending: "bg-orange-100 text-orange-800",
    paid: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-800",
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Referral Payouts</h1>
          <p className="text-gray-500">Process partner commission payments</p>
        </div>
        <Button
          onClick={() => {
            setGenerateDialog(true);
            generateMonthlyPayouts();
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate Monthly Payouts
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Total Pending</div>
            <div className="text-2xl font-bold text-orange-600">
              ${totalPending.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Active Referrals</div>
            <div className="text-2xl font-bold">{referrals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">This Month</div>
            <div className="text-2xl font-bold">
              {new Date().toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Bulk Actions */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 p-2 bg-gray-100 rounded-lg">
            <span className="text-sm font-medium">{selectedIds.length} selected</span>
            <Button size="sm" onClick={() => setMarkPaidDialog(true)}>
              <Check className="w-3 h-3 mr-1" />
              Mark Paid
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Payouts Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredPayouts.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No payouts found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        selectedIds.length === filteredPayouts.length &&
                        filteredPayouts.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayouts.map((payout) => (
                  <TableRow
                    key={payout.id}
                    className={selectedIds.includes(payout.id) ? "bg-gray-50" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(payout.id)}
                        onCheckedChange={() => toggleSelect(payout.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {payout.referrals?.referral_partners?.contact_name || "—"}
                        </div>
                        {payout.referrals?.referral_partners?.company_name && (
                          <div className="text-sm text-gray-500">
                            {payout.referrals.referral_partners.company_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {payout.referrals?.projects?.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {payout.period_start
                        ? new Date(payout.period_start).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="capitalize">
                      {payout.payout_type?.replace("_", " ")}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${payout.amount?.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[payout.status]}>
                        {payout.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {payout.payment_reference || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate Payouts Dialog */}
      <Dialog open={generateDialog} onOpenChange={setGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Monthly Payouts</DialogTitle>
            <DialogDescription>
              Create pending payout records for the current month.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {generating ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Calculating...</p>
              </div>
            ) : generatedPayouts.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No new payouts to generate. All referrals are up to date.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">
                  {generatedPayouts.length} payout(s) will be created:
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {generatedPayouts.map((payout, idx) => {
                    const referral = referrals.find(
                      (r) => r.id === payout.referral_id
                    );
                    return (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm"
                      >
                        <div>
                          <span className="font-medium">
                            {referral?.referral_partners?.contact_name}
                          </span>
                          <span className="text-gray-500">
                            {" "}
                            - {referral?.projects?.name}
                          </span>
                        </div>
                        <span className="font-semibold">
                          ${payout.amount.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-2 border-t mt-4">
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>
                      $
                      {generatedPayouts
                        .reduce((sum, p) => sum + p.amount, 0)
                        .toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmGeneratePayouts}
              disabled={generatedPayouts.length === 0}
            >
              Create Payouts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={markPaidDialog} onOpenChange={setMarkPaidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Mark {selectedIds.length} payout(s) as paid.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Payment Reference (optional)
              </label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Check #, Transaction ID, etc."
              />
            </div>
            <div className="text-sm text-gray-600">
              Total:{" "}
              <span className="font-semibold">
                $
                {payouts
                  .filter((p) => selectedIds.includes(p.id))
                  .reduce((sum, p) => sum + (p.amount || 0), 0)
                  .toLocaleString()}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkPaid}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
