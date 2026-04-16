import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { FolderKanban, CheckSquare, FileText, ArrowRight } from "lucide-react";

export default function ClientDashboard() {
  const { user, userProfile } = useAuth();
  const [stats, setStats] = useState({
    activeProjects: 0,
    pendingApprovals: 0,
    openInvoices: 0,
    recentProjects: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        // Find accessible account(s) via the contact→auth linkage
        const { data: contact } = await supabase
          .from("contacts")
          .select("account_id")
          .eq("portal_user_id", user.id)
          .maybeSingle();
        if (!contact?.account_id) {
          setLoading(false);
          return;
        }

        const [
          { data: projects = [] },
          { count: approvals = 0 },
          { count: invoicesOpen = 0 },
        ] = await Promise.all([
          supabase
            .from("projects")
            .select("id, name, status, risk_level")
            .eq("account_id", contact.account_id)
            .eq("client_visible", true)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("social_posts")
            .select("id", { count: "exact", head: true })
            .eq("client_id", contact.account_id)
            .eq("approved", false),
          supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq("account_id", contact.account_id)
            .in("status", ["sent", "overdue"]),
        ]);

        setStats({
          activeProjects: projects?.length || 0,
          pendingApprovals: approvals || 0,
          openInvoices: invoicesOpen || 0,
          recentProjects: projects || [],
        });
      } catch (err) {
        console.error("Dashboard load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const firstName = (userProfile?.full_name || "").split(" ")[0] || "there";

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-gray-900 dark:text-gray-100">Welcome back, {firstName}</h1>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
          Here's what's happening on your projects.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={FolderKanban}
          label="Active projects"
          value={loading ? "—" : stats.activeProjects}
          to="/client/projects"
        />
        <StatCard
          icon={CheckSquare}
          label="Pending approvals"
          value={loading ? "—" : stats.pendingApprovals}
          to="/client/approvals"
          highlight={stats.pendingApprovals > 0}
        />
        <StatCard
          icon={FileText}
          label="Open invoices"
          value={loading ? "—" : stats.openInvoices}
          to="/client/invoices"
          highlight={stats.openInvoices > 0}
        />
      </div>

      {/* Recent projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Recent projects</h2>
          <Link to="/client/projects" className="text-[12px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 inline-flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-800">
          {loading ? (
            <div className="py-8 text-center text-[13px] text-gray-400 dark:text-gray-500">Loading…</div>
          ) : stats.recentProjects.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">
              No active projects yet. Your team will add them here.
            </div>
          ) : (
            stats.recentProjects.map((p) => (
              <Link
                key={p.id}
                to={`/client/projects/${p.id}`}
                className="flex items-center gap-3 px-2 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="flex-1 text-[14px] text-gray-900 dark:text-gray-100">{p.name}</span>
                <span className="text-[11px] capitalize text-gray-500 dark:text-gray-400">{p.status}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, to, highlight = false }) {
  return (
    <Link
      to={to}
      className={`block border rounded-md p-4 transition-colors ${
        highlight
          ? "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-900/20 hover:border-amber-400"
          : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900"
      }`}
    >
      <div className="flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400 mb-2">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{value}</div>
    </Link>
  );
}
