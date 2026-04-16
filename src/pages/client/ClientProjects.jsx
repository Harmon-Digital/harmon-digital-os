import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { ArrowRight } from "lucide-react";

const STATUS_DOT = {
  active: "bg-green-500",
  on_hold: "bg-amber-500",
  completed: "bg-gray-400",
  cancelled: "bg-red-500",
};

export default function ClientProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data: contact } = await supabase
          .from("contacts")
          .select("account_id")
          .eq("portal_user_id", user.id)
          .maybeSingle();
        if (!contact?.account_id) { setLoading(false); return; }

        const { data } = await supabase
          .from("projects")
          .select("id, name, status, risk_level, description, start_date, end_date")
          .eq("account_id", contact.account_id)
          .eq("client_visible", true)
          .order("status", { ascending: true })
          .order("created_at", { ascending: false });
        setProjects(data || []);
      } catch (err) {
        console.error("Projects load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100 mb-1">Projects</h1>
      <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-6">
        All projects your team is working on.
      </p>

      <div className="border-t border-gray-200 dark:border-gray-800">
        {loading ? (
          <div className="py-10 text-center text-[13px] text-gray-400 dark:text-gray-500">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-gray-500 dark:text-gray-400">
            No projects yet.
          </div>
        ) : (
          projects.map((p) => (
            <Link
              key={p.id}
              to={`/client/projects/${p.id}`}
              className="flex items-center gap-3 px-2 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
            >
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[p.status] || "bg-gray-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-gray-900 dark:text-gray-100 truncate">{p.name}</div>
                {p.description && (
                  <div className="text-[12px] text-gray-500 dark:text-gray-400 truncate">{p.description}</div>
                )}
              </div>
              <span className="text-[11px] capitalize text-gray-500 dark:text-gray-400 shrink-0">
                {p.status?.replace("_", " ")}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
