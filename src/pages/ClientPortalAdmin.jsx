import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/api/supabaseClient";
import { Contact, Account } from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
import {
  UserPlus,
  Mail,
  Check,
  Clock,
  Ban,
  RefreshCw,
  ExternalLink,
  Search,
  Building2,
  Users as UsersIcon,
  Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

export default function ClientPortalAdmin() {
  const { userProfile } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | active | invited | none
  const [busyId, setBusyId] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null);

  const isAdmin = userProfile?.role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cts, accs] = await Promise.all([
        Contact.list("-portal_invited_at"),
        Account.list(),
      ]);
      setContacts(cts || []);
      setAccounts(accs || []);
    } catch (err) {
      console.error("ClientPortalAdmin load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const accountMap = useMemo(() => {
    const m = new Map();
    for (const a of accounts) m.set(a.id, a);
    return m;
  }, [accounts]);

  const invoke = async (contact, action) => {
    if (!isAdmin) return;
    setBusyId(contact.id);
    try {
      const { data, error } = await supabase.functions.invoke("invite-client-portal", {
        body: { contactId: contact.id, action },
      });
      if (error) throw error;
      if (data?.error && !data?.alreadyInvited) throw new Error(data.error);
      if (action === "invite") toast.success(`Invite sent to ${contact.email}`);
      else if (action === "resend") toast.success("Invite re-sent");
      else if (action === "revoke") toast.success("Portal access revoked");
      await load();
    } catch (err) {
      console.error(`${action} failed:`, err);
      toast.error(`${action} failed`, { description: err.message });
    } finally {
      setBusyId(null);
      setConfirmRevoke(null);
    }
  };

  // Status buckets
  const withStatus = useMemo(() => {
    return contacts.map((c) => {
      let status = "none";
      if (c.portal_user_id) {
        status = c.portal_last_login_at ? "active" : "invited";
      }
      return { ...c, status };
    });
  }, [contacts]);

  const counts = useMemo(() => {
    const byStatus = { all: withStatus.length, active: 0, invited: 0, none: 0 };
    for (const c of withStatus) byStatus[c.status]++;
    return byStatus;
  }, [withStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withStatus
      .filter((c) => filter === "all" || c.status === filter)
      .filter((c) => {
        if (!q) return true;
        const name = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
        const company = accountMap.get(c.account_id)?.company_name?.toLowerCase() || "";
        return (
          name.includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          company.includes(q)
        );
      })
      .sort((a, b) => {
        // Active first, then invited, then uninvited
        const rank = { active: 0, invited: 1, none: 2 };
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
        return (b.portal_invited_at || "").localeCompare(a.portal_invited_at || "");
      });
  }, [withStatus, search, filter, accountMap]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="px-4 lg:px-6 pt-5 pb-3">
        <h1 className="text-[22px] font-semibold text-gray-900 dark:text-gray-100">Client Portal</h1>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
          Invite clients so they can view their projects, approve content, pay invoices, and access shared files.
        </p>

        {/* Inline stats */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-gray-600 dark:text-gray-400 mt-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Active <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{counts.active}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Invited <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{counts.invited}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Uninvited <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{counts.none}</span>
          </span>
          <span className="flex items-center gap-1.5">
            Total contacts <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{counts.all}</span>
          </span>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center gap-2 px-4 lg:px-6 h-12 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5 text-[12px]">
          {[
            { id: "all", label: "All" },
            { id: "active", label: "Active" },
            { id: "invited", label: "Invited" },
            { id: "none", label: "Uninvited" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded ${
                filter === f.id
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <Input
            placeholder="Search by name, email, or company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-[13px] border-gray-200 dark:border-gray-800"
          />
        </div>

        <div className="ml-auto text-[11px] text-gray-400 hidden md:block">
          {filtered.length} {filtered.length === 1 ? "contact" : "contacts"}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-10 text-center text-[13px] text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-gray-500 dark:text-gray-400">
            {filter === "active" && "No active clients yet. Invite someone to get started."}
            {filter === "invited" && "No pending invites."}
            {filter === "none" && "All contacts have been invited."}
            {filter === "all" && "No contacts match your search."}
          </div>
        ) : (
          filtered.map((c) => {
            const account = accountMap.get(c.account_id);
            const initials = `${c.first_name?.[0] || ""}${c.last_name?.[0] || ""}`.toUpperCase() || "?";
            const busy = busyId === c.id;
            return (
              <div
                key={c.id}
                className="group flex items-center gap-3 px-4 lg:px-6 py-2.5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40"
              >
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center text-[11px] font-medium flex-shrink-0">
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-gray-900 dark:text-gray-100 font-medium truncate">
                    {c.first_name} {c.last_name}
                    {!c.first_name && !c.last_name && c.email}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{c.email || "no email"}</span>
                    {account && (
                      <>
                        <span>·</span>
                        <Building2 className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{account.company_name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status pill */}
                <StatusPill status={c.status} contact={c} />

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {c.status === "none" && (
                    <Button
                      size="sm"
                      disabled={busy || !c.email || !isAdmin}
                      onClick={() => invoke(c, "invite")}
                      className="h-7 px-2.5 text-[12px] bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900"
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1" />
                      {busy ? "Inviting…" : "Invite"}
                    </Button>
                  )}
                  {(c.status === "invited" || c.status === "active") && (
                    <>
                      <button
                        type="button"
                        disabled={busy || !isAdmin}
                        onClick={() => invoke(c, "resend")}
                        title="Resend magic link"
                        className="p-1.5 rounded text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        type="button"
                        disabled={busy || !isAdmin}
                        onClick={() => setConfirmRevoke(c)}
                        title="Revoke portal access"
                        className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Help footer */}
      <div className="border-t border-gray-200 dark:border-gray-800 px-4 lg:px-6 py-3 bg-gray-50/50 dark:bg-gray-900/40">
        <div className="flex items-start gap-3 text-[12px]">
          <Eye className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="text-gray-600 dark:text-gray-400">
            <p className="text-gray-900 dark:text-gray-100 font-medium mb-0.5">What clients see</p>
            Their active projects (with <code className="text-gray-700 dark:text-gray-300">client_visible = true</code>),
            invoices for their account, social posts pending approval, and files/tasks you've marked client-visible.
            Everything is scoped by RLS, so they can never access another client's data.
            The <a href="/client/login" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-0.5">portal login page <ExternalLink className="w-3 h-3" /></a> lives at <code className="text-gray-700 dark:text-gray-300">/client/login</code>.
          </div>
        </div>
      </div>

      {/* Revoke confirmation */}
      <Dialog open={!!confirmRevoke} onOpenChange={(open) => !open && setConfirmRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke portal access?</DialogTitle>
            <DialogDescription>
              This will delete the auth user for <strong>{confirmRevoke?.email}</strong> and remove their portal access immediately.
              They can be re-invited later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevoke(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => invoke(confirmRevoke, "revoke")}
              disabled={busyId === confirmRevoke?.id}
            >
              {busyId === confirmRevoke?.id ? "Revoking…" : "Revoke access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({ status, contact }) {
  if (status === "active") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded"
        title={contact.portal_last_login_at ? `Last login ${new Date(contact.portal_last_login_at).toLocaleDateString()}` : "Active"}
      >
        <Check className="w-3 h-3" />
        Active
      </span>
    );
  }
  if (status === "invited") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded"
        title={contact.portal_invited_at ? `Invited ${new Date(contact.portal_invited_at).toLocaleDateString()}` : "Invited"}
      >
        <Clock className="w-3 h-3" />
        Invited
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
      <UsersIcon className="w-3 h-3" />
      Not invited
    </span>
  );
}
