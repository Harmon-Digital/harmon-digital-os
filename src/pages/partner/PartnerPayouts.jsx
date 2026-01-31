import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { DollarSign } from "lucide-react";

export default function PartnerPayouts() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [stats, setStats] = useState({ paid: 0, pending: 0 });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: partner } = await supabase
        .from("referral_partners")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (partner) {
        const { data: referrals } = await supabase
          .from("referrals")
          .select("id, projects(name)")
          .eq("partner_id", partner.id);

        if (referrals?.length) {
          const { data: payoutsData } = await supabase
            .from("referral_payouts")
            .select("*, referrals(projects(name))")
            .in("referral_id", referrals.map(r => r.id))
            .order("created_at", { ascending: false });

          setPayouts(payoutsData || []);

          const paid = payoutsData
            ?.filter(p => p.status === "paid")
            .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
          const pending = payoutsData
            ?.filter(p => p.status === "pending")
            .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

          setStats({ paid, pending });
        }
      }
    } catch (error) {
      console.error("Error loading payouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayouts = payouts.filter(p => {
    if (statusFilter === "all") return true;
    return p.status === statusFilter;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-12 max-w-6xl">
      {/* Header */}
      <div className="mb-12">
        <p className="text-neutral-500 text-sm uppercase tracking-wider mb-2">Payouts</p>
        <h1 className="text-4xl font-medium text-white mb-2">Payment History</h1>
        <p className="text-neutral-500 text-lg">
          Track your commission payments.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <p className="text-neutral-500 text-sm mb-2">Total Paid</p>
          <p className="text-3xl font-medium text-emerald-400">${stats.paid.toLocaleString()}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <p className="text-neutral-500 text-sm mb-2">Pending</p>
          <p className="text-3xl font-medium text-amber-400">${stats.pending.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6">
        {["all", "pending", "paid"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              statusFilter === status
                ? "bg-white text-black"
                : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
            }`}
          >
            {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
        <span className="text-neutral-600 text-sm ml-4">
          {filteredPayouts.length} payout{filteredPayouts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Payouts Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl">
        {filteredPayouts.length === 0 ? (
          <div className="text-center py-16">
            <DollarSign className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
            <p className="text-neutral-400">No payouts found</p>
          </div>
        ) : (
          <div>
            {/* Table Header */}
            <div className="grid grid-cols-6 gap-4 px-6 py-4 border-b border-neutral-800 text-neutral-500 text-sm">
              <div>Date</div>
              <div>Referral</div>
              <div>Type</div>
              <div>Period</div>
              <div>Amount</div>
              <div>Status</div>
            </div>

            {/* Table Body */}
            {filteredPayouts.map((payout) => (
              <div
                key={payout.id}
                className="grid grid-cols-6 gap-4 px-6 py-4 border-b border-neutral-800 last:border-0 items-center"
              >
                <div className="text-neutral-300 text-sm">
                  {payout.paid_date
                    ? new Date(payout.paid_date).toLocaleDateString()
                    : new Date(payout.created_at).toLocaleDateString()}
                </div>
                <div className="text-white font-medium text-sm">
                  {payout.referrals?.projects?.name || "—"}
                </div>
                <div className="text-neutral-400 text-sm capitalize">
                  {payout.payout_type?.replace("_", " ")}
                </div>
                <div className="text-neutral-500 text-sm">
                  {payout.period_start
                    ? new Date(payout.period_start).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </div>
                <div className="text-white font-medium">
                  ${payout.amount?.toLocaleString()}
                </div>
                <div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      payout.status === "paid"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : payout.status === "pending"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-neutral-500/10 text-neutral-400"
                    }`}
                  >
                    {payout.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
