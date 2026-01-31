import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronDown, ChevronRight, Users } from "lucide-react";

export default function PartnerReferrals() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [payoutsByReferral, setPayoutsByReferral] = useState({});

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
        const { data: referralsData } = await supabase
          .from("referrals")
          .select(`
            *,
            projects(
              name,
              status,
              billing_type,
              monthly_retainer,
              valuation_percentage,
              success_fee_status
            )
          `)
          .eq("partner_id", partner.id)
          .order("referral_date", { ascending: false });

        setReferrals(referralsData || []);

        if (referralsData?.length) {
          const { data: payouts } = await supabase
            .from("referral_payouts")
            .select("*")
            .in("referral_id", referralsData.map(r => r.id))
            .order("period_start", { ascending: false });

          const grouped = {};
          payouts?.forEach(p => {
            if (!grouped[p.referral_id]) grouped[p.referral_id] = [];
            grouped[p.referral_id].push(p);
          });
          setPayoutsByReferral(grouped);
        }
      }
    } catch (error) {
      console.error("Error loading referrals:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyCommission = (referral) => {
    const monthlyRetainer = referral.projects?.monthly_retainer || 0;
    const rate = referral.commission_rate || 15;
    return monthlyRetainer * (rate / 100);
  };

  const calculateTotalEarned = (referralId) => {
    const payouts = payoutsByReferral[referralId] || [];
    return payouts
      .filter(p => p.status === "paid")
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  };

  const getMonthsRemaining = (referral) => {
    const payouts = payoutsByReferral[referral.id] || [];
    const paidMonths = payouts.filter(p => p.payout_type === "retainer" && p.status === "paid").length;
    return Math.max(0, (referral.commission_months || 6) - paidMonths);
  };

  const statusColors = {
    pending: "bg-amber-500/10 text-amber-400",
    active: "bg-emerald-500/10 text-emerald-400",
    completed: "bg-blue-500/10 text-blue-400",
    cancelled: "bg-neutral-500/10 text-neutral-400",
  };

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
        <p className="text-neutral-500 text-sm uppercase tracking-wider mb-2">Referrals</p>
        <h1 className="text-4xl font-medium text-white mb-2">My Referrals</h1>
        <p className="text-neutral-500 text-lg">
          Track your referred clients and commissions.
        </p>
      </div>

      {/* Referrals List */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl">
        {referrals.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
            <p className="text-neutral-400 mb-2">No referrals yet</p>
            <p className="text-neutral-600 text-sm">
              Contact your partner manager to add referrals.
            </p>
          </div>
        ) : (
          <div>
            {/* Table Header */}
            <div className="grid grid-cols-7 gap-4 px-6 py-4 border-b border-neutral-800 text-neutral-500 text-sm">
              <div className="col-span-2">Client / Project</div>
              <div>Type</div>
              <div>Monthly</div>
              <div>Remaining</div>
              <div>Earned</div>
              <div>Status</div>
            </div>

            {/* Table Body */}
            {referrals.map((referral) => (
              <div key={referral.id}>
                <div
                  className="grid grid-cols-7 gap-4 px-6 py-4 border-b border-neutral-800 hover:bg-neutral-800/50 cursor-pointer transition-colors items-center"
                  onClick={() => setExpandedId(expandedId === referral.id ? null : referral.id)}
                >
                  <div className="col-span-2 flex items-center gap-3">
                    {expandedId === referral.id ? (
                      <ChevronDown className="w-4 h-4 text-neutral-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-neutral-500" />
                    )}
                    <div>
                      <p className="text-white font-medium">
                        {referral.projects?.name || referral.client_name || "—"}
                      </p>
                      <p className="text-neutral-500 text-xs">
                        {referral.status === "pending" ? (
                          <span className="text-amber-400">Awaiting approval</span>
                        ) : (
                          new Date(referral.referral_date).toLocaleDateString()
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-neutral-300 capitalize text-sm">
                    {referral.projects?.billing_type?.replace("_", " ") || "—"}
                  </div>
                  <div className="text-white font-medium">
                    ${calculateMonthlyCommission(referral).toLocaleString()}
                  </div>
                  <div className="text-neutral-400 text-sm">
                    {getMonthsRemaining(referral)} of {referral.commission_months || 6}
                  </div>
                  <div className="text-emerald-400 font-medium">
                    ${calculateTotalEarned(referral.id).toLocaleString()}
                  </div>
                  <div>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[referral.status]}`}>
                      {referral.status}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === referral.id && (
                  <div className="px-6 py-6 bg-neutral-950 border-b border-neutral-800">
                    {referral.status === "pending" ? (
                      <div className="grid grid-cols-4 gap-6 mb-6">
                        <div>
                          <p className="text-neutral-500 text-xs mb-1">Client Name</p>
                          <p className="text-white">{referral.client_name}</p>
                        </div>
                        <div>
                          <p className="text-neutral-500 text-xs mb-1">Email</p>
                          <p className="text-white">{referral.client_email}</p>
                        </div>
                        {referral.client_phone && (
                          <div>
                            <p className="text-neutral-500 text-xs mb-1">Phone</p>
                            <p className="text-white">{referral.client_phone}</p>
                          </div>
                        )}
                        {referral.client_company && (
                          <div>
                            <p className="text-neutral-500 text-xs mb-1">Company</p>
                            <p className="text-white">{referral.client_company}</p>
                          </div>
                        )}
                        {referral.notes && (
                          <div className="col-span-4">
                            <p className="text-neutral-500 text-xs mb-1">Notes</p>
                            <p className="text-white">{referral.notes}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-6 mb-6">
                        <div>
                          <p className="text-neutral-500 text-xs mb-1">Commission Rate</p>
                          <p className="text-white">{referral.commission_rate}%</p>
                        </div>
                        <div>
                          <p className="text-neutral-500 text-xs mb-1">Monthly Retainer</p>
                          <p className="text-white">${referral.projects?.monthly_retainer?.toLocaleString() || 0}</p>
                        </div>
                        {referral.projects?.billing_type === "exit" && (
                          <div>
                            <p className="text-neutral-500 text-xs mb-1">Success Fee %</p>
                            <p className="text-white">{referral.projects?.valuation_percentage}%</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payout History - only show for active/completed referrals */}
                    {referral.status !== "pending" && (
                    <div>
                      <h4 className="text-white text-sm font-medium mb-3">Payout History</h4>
                      {(payoutsByReferral[referral.id] || []).length === 0 ? (
                        <p className="text-neutral-600 text-sm">No payouts yet</p>
                      ) : (
                        <div className="space-y-2">
                          {payoutsByReferral[referral.id].map((payout) => (
                            <div
                              key={payout.id}
                              className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg"
                            >
                              <div className="text-sm">
                                {payout.period_start && payout.period_end ? (
                                  <span className="text-neutral-300">
                                    {new Date(payout.period_start).toLocaleDateString("en-US", {
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-neutral-300 capitalize">
                                    {payout.payout_type?.replace("_", " ")}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-white font-medium">
                                  ${payout.amount?.toLocaleString()}
                                </span>
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
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
