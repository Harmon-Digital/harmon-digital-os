import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { parseLocalDate } from "@/utils";
import { useClientAccount } from "@/hooks/useClientAccount";
import { ArrowLeft, CheckSquare, FileText, FileSignature } from "lucide-react";

export default function ClientProjectDetail() {
  const { id } = useParams();
  const { accountId, loading: accountLoading } = useClientAccount();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || accountLoading) return;
    if (!accountId) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        const [{ data: proj }, { data: ts = [] }, { data: docs = [] }] = await Promise.all([
          supabase
            .from("projects")
            .select("id, name, description, status, start_date, end_date, client_visible")
            .eq("id", id)
            .eq("account_id", accountId)
            .maybeSingle(),
          supabase
            .from("tasks")
            .select("id, title, status, due_date")
            .eq("project_id", id)
            .eq("client_visible", true)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("project_documents")
            .select("id, name, file_path, file_size, category, created_at")
            .eq("project_id", id)
            .eq("client_visible", true)
            .order("created_at", { ascending: false }),
        ]);
        setProject(proj);
        setTasks(ts || []);
        setDocuments(docs || []);
      } catch (err) {
        console.error("Project detail load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, accountId, accountLoading]);

  const contracts = documents.filter((d) => d.category === "contract");
  const otherDocs = documents.filter((d) => d.category !== "contract");

  if (loading) {
    return <div className="py-10 text-center text-[13px] text-gray-400">Loading…</div>;
  }
  if (!project) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link to="/client/projects" className="text-[13px] text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to projects
        </Link>
        <p className="mt-4 text-[13px] text-gray-500">Project not found or you don't have access.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div>
        <Link to="/client/projects" className="text-[13px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Projects
        </Link>
        <h1 className="text-[22px] font-semibold text-gray-900 dark:text-gray-100">{project.name}</h1>
        {project.description && (
          <p className="text-[14px] text-gray-600 dark:text-gray-400 mt-2">{project.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-gray-600 dark:text-gray-400 mt-3">
          <span>Status <span className="text-gray-900 dark:text-gray-100 font-medium capitalize">{project.status?.replace(/_/g, " ")}</span></span>
          {project.start_date && <span>Started <span className="text-gray-900 dark:text-gray-100 font-medium">{parseLocalDate(project.start_date).toLocaleDateString()}</span></span>}
          {project.end_date && <span>Target <span className="text-gray-900 dark:text-gray-100 font-medium">{parseLocalDate(project.end_date).toLocaleDateString()}</span></span>}
        </div>
      </div>

      {/* Tasks */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CheckSquare className="w-4 h-4 text-gray-500" />
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Tasks visible to you</h2>
          <span className="text-[11px] text-gray-400 tabular-nums">{tasks.length}</span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-800">
          {tasks.length === 0 ? (
            <div className="py-6 text-[13px] text-gray-500 dark:text-gray-400">No tasks shared yet.</div>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800">
                <span className={`w-2 h-2 rounded-full ${
                  t.status === "completed" ? "bg-green-500" :
                  t.status === "in_progress" ? "bg-blue-500" :
                  t.status === "blocked" ? "bg-red-500" : "bg-gray-400"
                }`} />
                <span className="flex-1 text-[13px] text-gray-900 dark:text-gray-100 truncate">{t.title}</span>
                <span className="text-[11px] capitalize text-gray-500 dark:text-gray-400">{t.status?.replace(/_/g, " ")}</span>
                {t.due_date && (
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 w-20 text-right">
                    {parseLocalDate(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Contracts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FileSignature className="w-4 h-4 text-gray-500" />
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Contracts</h2>
          <span className="text-[11px] text-gray-400 tabular-nums">{contracts.length}</span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-800">
          {contracts.length === 0 ? (
            <div className="py-6 text-[13px] text-gray-500 dark:text-gray-400">No contracts shared yet.</div>
          ) : (
            contracts.map((d) => (
              <a
                key={d.id}
                href={d.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <FileSignature className="w-4 h-4 text-gray-400" />
                <span className="flex-1 text-[13px] text-gray-900 dark:text-gray-100 truncate">{d.name}</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : ""}
                </span>
              </a>
            ))
          )}
        </div>
      </div>

      {/* Documents */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-gray-500" />
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Shared documents</h2>
          <span className="text-[11px] text-gray-400 tabular-nums">{otherDocs.length}</span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-800">
          {otherDocs.length === 0 ? (
            <div className="py-6 text-[13px] text-gray-500 dark:text-gray-400">No documents shared yet.</div>
          ) : (
            otherDocs.map((d) => (
              <a
                key={d.id}
                href={d.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="flex-1 text-[13px] text-gray-900 dark:text-gray-100 truncate">{d.name}</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : ""}
                </span>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
