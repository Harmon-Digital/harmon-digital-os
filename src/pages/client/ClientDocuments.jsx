import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { FileText, Download, Folder } from "lucide-react";

export default function ClientDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
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
        const { data: projs = [] } = await supabase
          .from("projects")
          .select("id, name")
          .eq("account_id", contact.account_id);
        const projectMap = new Map(projs.map((p) => [p.id, p.name]));
        const { data = [] } = await supabase
          .from("project_documents")
          .select("id, name, file_path, file_size, project_id, created_at")
          .in("project_id", projs.map((p) => p.id))
          .eq("client_visible", true)
          .order("created_at", { ascending: false });
        setDocuments(data.map((d) => ({ ...d, project_name: projectMap.get(d.project_id) })));
      } catch (err) {
        console.error("Documents load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100 mb-1">Documents</h1>
      <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-6">
        Files your team has shared with you across all projects.
      </p>

      <div className="border-t border-gray-200 dark:border-gray-800">
        {loading ? (
          <div className="py-10 text-center text-[13px] text-gray-400">Loading…</div>
        ) : documents.length === 0 ? (
          <div className="py-16 text-center">
            <Folder className="w-7 h-7 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-[13px] text-gray-500 dark:text-gray-400">No documents shared yet.</p>
          </div>
        ) : (
          documents.map((d) => (
            <a
              key={d.id}
              href={d.file_path}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-2 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
            >
              <FileText className="w-4 h-4 text-gray-400" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-gray-900 dark:text-gray-100 truncate">{d.name}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {d.project_name || "—"}
                  {d.created_at && ` · ${new Date(d.created_at).toLocaleDateString()}`}
                </div>
              </div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 w-16 text-right">
                {d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : ""}
              </span>
              <Download className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))
        )}
      </div>
    </div>
  );
}
