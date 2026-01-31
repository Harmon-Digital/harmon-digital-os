import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { DollarSign, Users, Clock, TrendingUp, ArrowRight } from "lucide-react";

export default function PartnerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState(null);
  const [stats, setStats] = useState({
    totalEarned: 0,
    pendingPayouts: 0,
    activeReferrals: 0,
    totalReferrals: 0,
  });
  const [recentPayouts, setRecentPayouts] = useState([]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: partnerData } = await supabase
        .from("referral_partners")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setPartner(partnerData);

      if (partnerData) {
        const { data: referrals } = await supabase
          .from("referrals")
          .select("*, projects(name, status, billing_type, monthly_retainer)")
          .eq("partner_id", partnerData.id);

        const { data: payouts } = await supabase
          .from("referral_payouts")
          .select("*, referrals(projects(name))")
          .in("referral_id", referrals?.map(r => r.id) || [])
          .order("created_at", { ascending: false });

        const totalEarned = payouts
          ?.filter(p => p.status === "paid")
          .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

        const pendingPayouts = payouts
          ?.filter(p => p.status === "pending")
          .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

        const activeReferrals = referrals?.filter(r => r.status === "active").length || 0;

        setStats({
          totalEarned,
          pendingPayouts,
          activeReferrals,
          totalReferrals: referrals?.length || 0,
        });

        setRecentPayouts(payouts?.slice(0, 5) || []);
      }
    } catch (error) {
      console.error("Error loading partner data:", error);
    } finally {
      setLoading(false);
    }
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
        <p className="text-neutral-500 text-sm uppercase tracking-wider mb-2">Partner Dashboard</p>
        <h1 className="text-4xl font-medium text-white mb-2">
          Welcome back, {partner?.contact_name?.split(" ")[0] || "Partner"}.
        </h1>
        <p className="text-neutral-500 text-lg">
          Here's your referral earnings overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-neutral-500 text-sm">Total Earned</span>
            <DollarSign className="w-5 h-5 text-neutral-600" />
          </div>
          <div className="text-3xl font-medium text-white">
            ${stats.totalEarned.toLocaleString()}
          </div>
          <p className="text-neutral-600 text-sm mt-1">All time</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-neutral-500 text-sm">Pending</span>
            <Clock className="w-5 h-5 text-neutral-600" />
          </div>
          <div className="text-3xl font-medium text-white">
            ${stats.pendingPayouts.toLocaleString()}
          </div>
          <p className="text-neutral-600 text-sm mt-1">Awaiting payment</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-neutral-500 text-sm">Active Referrals</span>
            <Users className="w-5 h-5 text-neutral-600" />
          </div>
          <div className="text-3xl font-medium text-white">
            {stats.activeReferrals}
          </div>
          <p className="text-neutral-600 text-sm mt-1">Earning commissions</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-neutral-500 text-sm">Total Referrals</span>
            <TrendingUp className="w-5 h-5 text-neutral-600" />
          </div>
          <div className="text-3xl font-medium text-white">
            {stats.totalReferrals}
          </div>
          <p className="text-neutral-600 text-sm mt-1">All time</p>
        </div>
      </div>

      {/* Commission Terms */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-8">
        <h2 className="text-white font-medium mb-4">Your Commission Terms</h2>
        <div className="grid grid-cols-3 gap-8">
          <div>
            <p className="text-neutral-500 text-sm mb-1">Commission Rate</p>
            <p className="text-white text-xl font-medium">{partner?.commission_rate || 15}%</p>
          </div>
          <div>
            <p className="text-neutral-500 text-sm mb-1">Commission Period</p>
            <p className="text-white text-xl font-medium">{partner?.commission_months || 6} months</p>
          </div>
          <div>
            <p className="text-neutral-500 text-sm mb-1">Payment Method</p>
            <p className="text-white text-xl font-medium capitalize">
              {partner?.payment_method?.replace("_", " ") || "Bank Transfer"}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Payouts */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <h2 className="text-white font-medium">Recent Payouts</h2>
          <Link
            to="/partner/payouts"
            className="text-sm text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="p-6">
          {recentPayouts.length === 0 ? (
            <p className="text-neutral-500 text-center py-8">No payouts yet</p>
          ) : (
            <div className="space-y-4">
              {recentPayouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0"
                >
                  <div>
                    <p className="text-white text-sm font-medium">
                      {payout.referrals?.projects?.name || "Referral"}
                    </p>
                    <p className="text-neutral-500 text-xs">
                      {payout.payout_type === "success_fee" ? "Success Fee" : "Monthly Commission"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">
                      ${payout.amount?.toLocaleString()}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
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
    </div>
  );
}
