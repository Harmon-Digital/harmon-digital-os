import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Check } from "lucide-react";

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
        const { error } = await supabase.from("referral_payouts").insert(generatedPayouts);
        if (error) throw error;
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
      const { error } = await supabase
        .from("referral_payouts")
        .update({
          status: "paid",
          paid_date: new Date().toISOString().split("T")[0],
          payment_reference: paymentReference,
        })
        .in("id", selectedIds);
      if (error) throw error;

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

  const statusDot = {
    pending: "bg-amber-500",
    paid: "bg-green-500",
    cancelled: "bg-gray-300",
  };

  const statusText = {
    pending: "text-amber-600",
    paid: "text-green-600",
    cancelled: "text-gray-500",
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

  const currentMonthLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Consolidated toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 px-4 h-12">
          <span className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Referral Payouts</span>

          <div className="ml-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-8 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-gray-100">{selectedIds.length} selected</span>
              <Button
                size="sm"
                onClick={() => setMarkPaidDialog(true)}
                className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
              >
                <Check className="w-3 h-3 mr-1" />
                Mark Paid
              </Button>
              <Button
                variant="ghost"
                onClick={() => setSelectedIds([])}
                className="h-7 px-2 text-[13px]"
              >
                Clear
              </Button>
            </div>
          )}

          <div className="ml-auto">
            <Button
              onClick={() => {
                setGenerateDialog(true);
                generateMonthlyPayouts();
              }}
              className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Generate Monthly
            </Button>
          </div>
        </div>

        {/* Metric pill strip */}
        <div className="flex items-center gap-5 px-4 h-9 border-t border-gray-100 dark:border-gray-800">
          <span className="text-[13px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Total pending
            <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">
              ${totalPending.toLocaleString()}
            </span>
          </span>
          <span className="text-[13px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Active referrals
            <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{referrals.length}</span>
          </span>
          <span className="text-[13px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Period
            <span className="text-gray-900 dark:text-gray-100 font-medium">{currentMonthLabel}</span>
          </span>
          <span className="text-[12px] text-gray-400 dark:text-gray-500 ml-auto tabular-nums">
            {filteredPayouts.length} {filteredPayouts.length === 1 ? "payout" : "payouts"}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 min-h-0 bg-white dark:bg-gray-950">
        {loading ? (
          <div className="p-8 text-center text-[13px] text-gray-400 dark:text-gray-500">Loading…</div>
        ) : filteredPayouts.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-gray-400 dark:text-gray-500">
            <p>No payouts found</p>
          </div>
        ) : (
          <>
            <div className="h-7 flex items-center px-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <div className="w-6 flex justify-center">
                <Checkbox
                  checked={
                    selectedIds.length === filteredPayouts.length &&
                    filteredPayouts.length > 0
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </div>
              <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                {statusFilter === "all" ? "All payouts" : `${statusFilter} payouts`}
              </span>
              <span className="ml-2 text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                {filteredPayouts.length}
              </span>
            </div>
            {filteredPayouts.map((payout) => {
              const checked = selectedIds.includes(payout.id);
              return (
                <div
                  key={payout.id}
                  className={`flex items-center gap-3 px-3 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
                    checked ? "bg-gray-50 dark:bg-gray-900" : ""
                  }`}
                >
                  <div className="w-6 flex justify-center shrink-0">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleSelect(payout.id)}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-gray-900 dark:text-gray-100 font-medium truncate">
                      {payout.referrals?.referral_partners?.contact_name || "—"}
                    </div>
                    {payout.referrals?.referral_partners?.company_name && (
                      <div className="text-[12px] text-gray-500 truncate">
                        {payout.referrals.referral_partners.company_name}
                      </div>
                    )}
                  </div>

                  <span className="hidden md:inline text-[13px] text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                    {payout.referrals?.projects?.name || "—"}
                  </span>

                  <span className="hidden lg:inline text-[12px] text-gray-500 tabular-nums w-24 text-right">
                    {payout.period_start
                      ? new Date(payout.period_start).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </span>

                  <span className="hidden lg:inline text-[12px] text-gray-500 capitalize w-20 text-right">
                    {payout.payout_type?.replace("_", " ") || "—"}
                  </span>

                  <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium tabular-nums w-24 text-right">
                    ${payout.amount?.toLocaleString()}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 text-[12px] w-20 shrink-0 ${
                      statusText[payout.status] || "text-gray-500"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${statusDot[payout.status] || "bg-gray-300"}`}
                    />
                    <span className="capitalize">{payout.status}</span>
                  </span>

                  <span className="hidden xl:inline text-[12px] text-gray-400 dark:text-gray-500 truncate max-w-[120px]">
                    {payout.payment_reference || "—"}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

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
                <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Calculating...</p>
              </div>
            ) : generatedPayouts.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No new payouts to generate. All referrals are up to date.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {generatedPayouts.length} payout(s) will be created:
                </p>
                <div className="max-h-60 overflow-y-auto">
                  {generatedPayouts.map((payout, idx) => {
                    const referral = referrals.find(
                      (r) => r.id === payout.referral_id
                    );
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 text-[13px]"
                      >
                        <span className="flex-1 min-w-0 truncate">
                          <span className="text-gray-900 dark:text-gray-100 font-medium">
                            {referral?.referral_partners?.contact_name}
                          </span>
                          <span className="text-gray-500">
                            {" · "}
                            {referral?.projects?.name}
                          </span>
                        </span>
                        <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums shrink-0">
                          ${payout.amount.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-2 border-t mt-4">
                  <div className="flex justify-between text-[13px] font-medium">
                    <span>Total</span>
                    <span className="tabular-nums">
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
              className="bg-gray-900 hover:bg-gray-800 text-white"
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
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total:{" "}
              <span className="font-semibold tabular-nums">
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
            <Button
              onClick={handleMarkPaid}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
