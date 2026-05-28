import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
import {
  Clock,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Settings as SettingsIcon,
  History,
} from "lucide-react";

const SYNC_ENDPOINT = "https://ctfichbfoligaiabudjv.supabase.co/functions/v1/toggl-sync";

function StatusDot({ status }) {
  const map = {
    ok: "bg-green-500",
    error: "bg-red-500",
    running: "bg-amber-500",
  };
  return <span className={`w-1.5 h-1.5 rounded-full inline-block ${map[status] ?? "bg-gray-400"}`} />;
}

function formatDateTime(iso) {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function SummaryGrid({ summary }) {
  if (!summary) return null;
  const cells = [
    ["Clients up", summary?.clients?.upserted ?? 0],
    ["Clients linked", summary?.clients?.linked ?? 0],
    ["Projects up", summary?.projects?.upserted ?? 0],
    ["Projects linked", summary?.projects?.linked ?? 0],
    ["Projects skipped", summary?.projects?.skipped ?? 0],
    ["Users up", summary?.users?.upserted ?? 0],
    ["Users linked", summary?.users?.linked ?? 0],
    ["Users unmatched", summary?.users?.unmatched ?? 0],
    ["Entries up", summary?.entries?.upserted ?? 0],
    ["Entries skipped (no project)", summary?.entries?.skipped_missing_project ?? 0],
    ["Entries skipped (no user)", summary?.entries?.skipped_missing_user ?? 0],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
      {cells.map(([label, value]) => (
        <div key={label} className="text-[13px] text-gray-600 dark:text-gray-400">
          {label} <span className="text-gray-900 dark:text-gray-100 font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function TogglSync() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState(null);
  const [runs, setRuns] = useState([]);

  // Editable form state (mirrors settings so we can apply on Save).
  const [workspaceId, setWorkspaceId] = useState("");
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [backfillFrom, setBackfillFrom] = useState("");

  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    if (userProfile && !isAdmin) navigate("/Dashboard");
  }, [userProfile, isAdmin, navigate]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: settingsRow }, { data: runRows }, { data: accountRows }] = await Promise.all([
      supabase.from("toggl_settings").select("*").limit(1).maybeSingle(),
      supabase.from("toggl_sync_runs").select("*").order("started_at", { ascending: false }).limit(10),
      supabase.from("accounts").select("id, company_name").order("company_name"),
    ]);

    setSettings(settingsRow ?? null);
    setRuns(runRows ?? []);
    setAccounts(accountRows ?? []);

    setWorkspaceId(settingsRow?.workspace_id ? String(settingsRow.workspace_id) : "");
    setDefaultAccountId(settingsRow?.default_account_id ?? "");
    setEnabled(settingsRow?.enabled ?? true);
    setBackfillFrom(settingsRow?.backfill_from ?? "");

    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin, loadAll]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        workspace_id: workspaceId ? Number(workspaceId) : null,
        default_account_id: defaultAccountId || null,
        enabled,
        backfill_from: backfillFrom || null,
      };
      if (settings?.id) {
        const { error } = await supabase.from("toggl_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("toggl_settings").insert(payload);
        if (error) throw error;
      }
      toast.success("Settings saved");
      await loadAll();
    } catch (err) {
      toast.error(`Save failed: ${err.message ?? err}`);
    }
    setSaving(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const res = await fetch(SYNC_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ trigger: "manual" }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast.success("Sync complete");
      await loadAll();
    } catch (err) {
      toast.error(`Sync failed: ${err.message ?? err}`);
    }
    setSyncing(false);
  };

  if (!isAdmin) return null;

  return (
    <div className="p-4 lg:p-6 max-w-5xl">
      <div className="flex items-center h-12 border-b border-gray-200 dark:border-gray-800 mb-4">
        <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Toggl Sync</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-[13px] px-2 py-8 justify-center">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading...
        </div>
      ) : (
        <div className="space-y-8">
          {/* Status strip */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                <span className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">Status</span>
              </div>
              <Button
                onClick={handleSync}
                disabled={syncing || !settings?.workspace_id}
                size="sm"
                className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px] gap-1"
              >
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {syncing ? "Syncing..." : "Sync now"}
              </Button>
            </div>

            <div className="px-2 space-y-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <span className="text-[13px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  Last sync <StatusDot status={settings?.last_sync_status} />
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{settings?.last_sync_status ?? "never"}</span>
                </span>
                <span className="text-[13px] text-gray-600 dark:text-gray-400">
                  At <span className="text-gray-900 dark:text-gray-100 font-medium">{formatDateTime(settings?.last_sync_at)}</span>
                </span>
                <span className="text-[13px] text-gray-600 dark:text-gray-400">
                  Workspace <span className="text-gray-900 dark:text-gray-100 font-medium">{settings?.workspace_id ?? "—"}</span>
                </span>
              </div>

              {settings?.last_sync_error && (
                <div className="flex items-start gap-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <code className="font-mono whitespace-pre-wrap break-words">{settings.last_sync_error}</code>
                </div>
              )}

              <SummaryGrid summary={settings?.last_sync_summary} />
            </div>
          </div>

          {/* Settings form */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
            <div className="flex items-center gap-2 px-2 mb-3">
              <SettingsIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">Settings</span>
            </div>

            <div className="space-y-4 px-2 max-w-xl">
              <div className="space-y-1.5">
                <Label htmlFor="workspaceId" className="text-[13px]">Toggl workspace ID</Label>
                <Input
                  id="workspaceId"
                  type="number"
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  placeholder="1234567"
                  className="text-[13px]"
                />
                <p className="text-[12px] text-gray-500">
                  Find it in Toggl: Settings &rarr; Workspaces &rarr; the numeric id at the end of the URL.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="defaultAccount" className="text-[13px]">
                  Default account for projects without a Toggl client
                </Label>
                <select
                  id="defaultAccount"
                  value={defaultAccountId}
                  onChange={(e) => setDefaultAccountId(e.target.value)}
                  className="w-full h-8 text-[13px] bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-2"
                >
                  <option value="">— None (skip those projects) —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.company_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="backfillFrom" className="text-[13px]">Backfill from (optional)</Label>
                <Input
                  id="backfillFrom"
                  type="date"
                  value={backfillFrom}
                  onChange={(e) => setBackfillFrom(e.target.value)}
                  className="text-[13px]"
                />
                <p className="text-[12px] text-gray-500">
                  Sets a one-off bulk import range. Cleared automatically after a successful run.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enabled" className="text-[13px]">Sync enabled</Label>
                  <p className="text-[12px] text-gray-500">Toggle off to pause the cron without losing settings.</p>
                </div>
                <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  size="sm"
                  className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>

          {/* Recent runs */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
            <div className="flex items-center gap-2 px-2 mb-2">
              <History className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">Recent runs</span>
            </div>

            {runs.length === 0 ? (
              <p className="text-[13px] text-gray-500 px-2">No runs yet.</p>
            ) : (
              <div className="border-t border-gray-200 dark:border-gray-800">
                {runs.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800">
                    <StatusDot status={r.status} />
                    <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 min-w-[80px]">{r.status}</span>
                    <span className="text-[13px] text-gray-500 min-w-[120px]">{r.trigger}</span>
                    <span className="text-[13px] text-gray-500 min-w-[160px]">{formatDateTime(r.started_at)}</span>
                    <span className="text-[13px] text-gray-500">
                      {r.range_from && r.range_to ? `${r.range_from} → ${r.range_to}` : ""}
                    </span>
                    {r.status === "ok" && r.summary?.entries?.upserted != null && (
                      <span className="ml-auto text-[12px] text-gray-500">
                        <CheckCircle2 className="w-3 h-3 inline mr-1 text-green-500" />
                        {r.summary.entries.upserted} entries
                      </span>
                    )}
                    {r.status === "error" && (
                      <span className="ml-auto text-[12px] text-red-600 truncate max-w-[280px]">{r.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
