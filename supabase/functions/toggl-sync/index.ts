/**
 * toggl-sync — Pull Toggl Track data into Harmon Digital OS.
 *
 * POST /functions/v1/toggl-sync
 * Body (all optional): { backfill_from?: "YYYY-MM-DD", trigger?: "manual"|"cron"|"backfill" }
 *
 * Auth: requires a logged-in admin (verified via JWT against team_members.role='admin').
 * The Toggl API token is read from the TOGGL_API_TOKEN env var — never trusted from the client.
 *
 * Sync order matters because time entries depend on projects + users, and projects
 * depend on clients (accounts):
 *   1. clients      -> public.accounts        (match on toggl_id, fall back to company_name)
 *   2. projects     -> public.projects        (match on toggl_id, fall back to name + account)
 *   3. users        -> public.team_members    (match on toggl_id, fall back to email)
 *   4. time entries -> public.time_entries    (match on toggl_id; needs project + member resolved)
 *
 * Incremental window:
 *   - Default: time entries updated since (last_sync_at - 5min) up to now.
 *   - If toggl_settings.backfill_from is set OR the request body provides backfill_from,
 *     the window opens to that date and the Reports API v3 is used for the bulk pull.
 *     The settings.backfill_from is cleared after a successful run.
 *
 * Toggl API references (v9, public):
 *   GET  /api/v9/me
 *   GET  /api/v9/workspaces/{wid}/clients
 *   GET  /api/v9/workspaces/{wid}/projects?active=both
 *   GET  /api/v9/workspaces/{wid}/users
 *   GET  /api/v9/me/time_entries?start_date=ISO&end_date=ISO     (recent only, ~3 months)
 *   POST /reports/api/v3/workspace/{wid}/search/time_entries     (backfill / arbitrary range)
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TOGGL_API_TOKEN = Deno.env.get("TOGGL_API_TOKEN");
const TOGGL_API_BASE = "https://api.track.toggl.com/api/v9";
const TOGGL_REPORTS_BASE = "https://api.track.toggl.com/reports/api/v3";
const CRON_SECRET = Deno.env.get("TOGGL_CRON_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Length-bounded constant-time compare so an attacker can't infer the secret
// from response-time differences. Always iterates over the longer string.
function timingSafeCompare(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function togglAuthHeader(): string {
  // Toggl Basic auth: base64("<api_token>:api_token")
  const raw = `${TOGGL_API_TOKEN}:api_token`;
  return `Basic ${btoa(raw)}`;
}

async function togglFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${TOGGL_API_BASE}${path}`;
  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", togglAuthHeader());
  headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Toggl ${init.method ?? "GET"} ${url} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  return res;
}

type Counts = {
  clients: { upserted: number; linked: number };
  projects: { upserted: number; linked: number; skipped: number };
  users: { upserted: number; linked: number; unmatched: number };
  entries: { upserted: number; skipped_missing_project: number; skipped_missing_user: number };
};

function emptyCounts(): Counts {
  return {
    clients: { upserted: 0, linked: 0 },
    projects: { upserted: 0, linked: 0, skipped: 0 },
    users: { upserted: 0, linked: 0, unmatched: 0 },
    entries: { upserted: 0, skipped_missing_project: 0, skipped_missing_user: 0 },
  };
}

async function syncClients(
  admin: SupabaseClient,
  workspaceId: number,
  counts: Counts,
) {
  const res = await togglFetch(`/workspaces/${workspaceId}/clients`);
  const clients = (await res.json()) as Array<{ id: number; name: string; archived?: boolean }> | null;
  if (!clients) return;

  for (const c of clients) {
    const togglId = String(c.id);

    // Prefer toggl_id; otherwise back-link an existing account by name.
    // Use two sequential .eq() queries — composing this into a single .or()
    // with raw client names is unsafe (Toggl names can contain PostgREST
    // operator chars like `,`, `*`, `(`, `)` that break or mis-target the
    // filter), and Supabase .eq() escapes its argument safely.
    let { data: existing } = await admin
      .from("accounts")
      .select("id, toggl_id")
      .eq("toggl_id", togglId)
      .maybeSingle();
    if (!existing) {
      const fallback = await admin
        .from("accounts")
        .select("id, toggl_id")
        .eq("company_name", c.name)
        .is("toggl_id", null)
        .limit(1)
        .maybeSingle();
      existing = fallback.data;
    }

    if (existing) {
      const wasLinked = existing.toggl_id === togglId;
      const { error: updErr } = await admin
        .from("accounts")
        .update({
          toggl_id: togglId,
          toggl_synced_at: new Date().toISOString(),
          // Don't overwrite company_name if already linked — admin may have customized it.
          ...(wasLinked ? {} : { company_name: c.name }),
        })
        .eq("id", existing.id);
      if (updErr) {
        console.error("[toggl-sync] account update failed", { togglId, err: updErr.message });
        continue;
      }
      if (wasLinked) counts.clients.upserted++;
      else counts.clients.linked++;
    } else {
      const { error: insErr } = await admin.from("accounts").insert({
        company_name: c.name,
        status: c.archived ? "inactive" : "active",
        toggl_id: togglId,
        toggl_synced_at: new Date().toISOString(),
      });
      if (insErr) {
        console.error("[toggl-sync] account insert failed", { togglId, err: insErr.message });
        continue;
      }
      counts.clients.upserted++;
    }
  }
}

async function syncProjects(
  admin: SupabaseClient,
  workspaceId: number,
  counts: Counts,
): Promise<Map<number, string>> {
  // Returns Toggl project_id -> HDO project uuid (for time-entry mapping).
  const map = new Map<number, string>();

  // Paginate — Toggl v9 caps per_page at 200; workspaces with more projects
  // would silently truncate without this loop, and their time entries then get
  // dropped as `skipped_missing_project`.
  type TogglProject = {
    id: number;
    name: string;
    client_id?: number | null;
    active?: boolean;
    rate?: number | null;
    billable?: boolean;
  };
  const projects: TogglProject[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await togglFetch(
      `/workspaces/${workspaceId}/projects?active=both&per_page=200&page=${page}`,
    );
    const batch = (await res.json()) as TogglProject[] | null;
    if (!Array.isArray(batch) || batch.length === 0) break;
    projects.push(...batch);
    if (batch.length < 200) break;
  }
  if (projects.length === 0) return map;

  // Build client_id -> account uuid lookup once.
  const { data: linkedAccounts } = await admin
    .from("accounts")
    .select("id, toggl_id")
    .not("toggl_id", "is", null);
  const clientToAccount = new Map<string, string>(
    (linkedAccounts ?? []).map((a) => [a.toggl_id!, a.id]),
  );

  for (const p of projects) {
    const togglId = String(p.id);
    const accountId = p.client_id ? clientToAccount.get(String(p.client_id)) ?? null : null;

    // See note in syncClients — avoid raw .or() against Toggl-controlled names.
    let { data: existing } = await admin
      .from("projects")
      .select("id, toggl_id, account_id")
      .eq("toggl_id", togglId)
      .maybeSingle();
    if (!existing) {
      const fallback = await admin
        .from("projects")
        .select("id, toggl_id, account_id")
        .eq("name", p.name)
        .is("toggl_id", null)
        .limit(1)
        .maybeSingle();
      existing = fallback.data;
    }

    if (existing) {
      const wasLinked = existing.toggl_id === togglId;
      const patch: Record<string, unknown> = {
        toggl_id: togglId,
        toggl_synced_at: new Date().toISOString(),
      };
      if (!wasLinked) {
        // First-time link: backfill basics from Toggl.
        patch.name = p.name;
        patch.status = p.active === false ? "completed" : "active";
        if (accountId && !existing.account_id) patch.account_id = accountId;
        if (p.rate != null) patch.hourly_rate = p.rate;
      }
      const { error: updErr } = await admin.from("projects").update(patch).eq("id", existing.id);
      if (updErr) {
        console.error("[toggl-sync] project update failed", { togglId, err: updErr.message });
        counts.projects.skipped++;
        continue;
      }
      map.set(p.id, existing.id);
      if (wasLinked) counts.projects.upserted++;
      else counts.projects.linked++;
    } else {
      // Need an account to satisfy projects.account_id NOT NULL.
      const resolvedAccount = accountId ?? (await resolveDefaultAccount(admin));
      if (!resolvedAccount) {
        counts.projects.skipped++;
        continue;
      }
      const { data: inserted } = await admin
        .from("projects")
        .insert({
          name: p.name,
          account_id: resolvedAccount,
          status: p.active === false ? "completed" : "active",
          billing_type: p.billable ? "hourly" : "fixed",
          hourly_rate: p.rate ?? null,
          toggl_id: togglId,
          toggl_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (inserted) {
        map.set(p.id, inserted.id);
        counts.projects.upserted++;
      } else {
        counts.projects.skipped++;
      }
    }
  }

  return map;
}

async function resolveDefaultAccount(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin
    .from("toggl_settings")
    .select("default_account_id")
    .limit(1)
    .maybeSingle();
  return data?.default_account_id ?? null;
}

async function syncUsers(
  admin: SupabaseClient,
  workspaceId: number,
  counts: Counts,
): Promise<Map<number, string>> {
  // Returns Toggl user_id -> HDO team_members uuid.
  const map = new Map<number, string>();

  const res = await togglFetch(`/workspaces/${workspaceId}/users`);
  const users = (await res.json()) as Array<{
    id: number;
    email: string;
    fullname?: string;
    name?: string;
  }> | null;
  if (!users) return map;

  for (const u of users) {
    const togglId = String(u.id);

    const { data: byToggl } = await admin
      .from("team_members")
      .select("id, toggl_id")
      .eq("toggl_id", togglId)
      .maybeSingle();

    if (byToggl) {
      await admin
        .from("team_members")
        .update({ toggl_synced_at: new Date().toISOString() })
        .eq("id", byToggl.id);
      map.set(u.id, byToggl.id);
      counts.users.upserted++;
      continue;
    }

    // Fall back to email match — team_members.email is the natural key for humans.
    const { data: byEmail } = await admin
      .from("team_members")
      .select("id")
      .ilike("email", u.email)
      .limit(1)
      .maybeSingle();

    if (byEmail) {
      await admin
        .from("team_members")
        .update({
          toggl_id: togglId,
          toggl_synced_at: new Date().toISOString(),
        })
        .eq("id", byEmail.id);
      map.set(u.id, byEmail.id);
      counts.users.linked++;
    } else {
      // We deliberately do NOT auto-create team_members — that requires an auth user
      // and HR intent. Record the miss so the admin can resolve.
      counts.users.unmatched++;
    }
  }

  return map;
}

type TogglEntry = {
  id: number;
  workspace_id?: number;
  project_id?: number | null;
  user_id?: number;
  uid?: number;            // Reports v3 alternate
  pid?: number | null;     // Reports v3 alternate
  description?: string | null;
  billable?: boolean;
  start: string;           // ISO 8601
  stop?: string | null;
  duration: number;        // seconds; negative = running
  tags?: string[];
  at?: string;             // last updated
};

// Formats a Date in the given IANA timezone as { date: YYYY-MM-DD, time: HH:MM:SS }.
// Toggl returns ISO timestamps in UTC; storing the UTC date/time misallocates
// late-evening entries to the next calendar day in the user's working timezone.
function formatInTimezone(d: Date, tz: string): { date: string; time: string } {
  // en-CA gives ISO-style YYYY-MM-DD; hour12=false avoids AM/PM mangling.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  // Intl can render hour as "24" at midnight in some impls; normalize.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}:${get("second")}`,
  };
}

async function syncTimeEntries(
  admin: SupabaseClient,
  workspaceId: number,
  projectMap: Map<number, string>,
  userMap: Map<number, string>,
  range: { from: string; to: string; useReports: boolean },
  counts: Counts,
  timezone: string,
) {
  // Always use the workspace-wide Reports endpoint. The /me/time_entries
  // endpoint only returns the API-token owner's entries, so an incremental
  // sync would silently miss every other team member's hours.
  const entries: TogglEntry[] = await fetchEntriesViaReports(workspaceId, range.from, range.to);

  for (const e of entries) {
    // Running timers (duration < 0) are skipped — we only mirror completed entries.
    if (!e.stop || e.duration < 0) continue;

    const projectIdRaw = e.project_id ?? e.pid ?? null;
    const userIdRaw = e.user_id ?? e.uid ?? null;

    const projectUuid = projectIdRaw != null ? projectMap.get(projectIdRaw) : null;
    const teamMemberUuid = userIdRaw != null ? userMap.get(userIdRaw) : null;

    if (!projectUuid) {
      counts.entries.skipped_missing_project++;
      continue;
    }
    if (!teamMemberUuid) {
      counts.entries.skipped_missing_user++;
      continue;
    }

    const start = new Date(e.start);
    const stop = new Date(e.stop);
    const hours = Math.round((e.duration / 3600) * 100) / 100;
    const { date, time: start_time } = formatInTimezone(start, timezone);
    const { time: end_time } = formatInTimezone(stop, timezone);
    const togglId = String(e.id);

    const payload = {
      project_id: projectUuid,
      team_member_id: teamMemberUuid,
      date,
      start_time,
      end_time,
      hours,
      description: e.description ?? null,
      billable: e.billable ?? true,
      toggl_id: togglId,
      toggl_synced_at: new Date().toISOString(),
      toggl_tags: e.tags ?? null,
    };

    // Single-shot upsert by toggl_id — avoids the SELECT-then-INSERT race
    // (two concurrent sync runs could both miss and double-insert) and saves
    // a round-trip per entry. Requires a unique constraint on toggl_id.
    const { error: writeErr } = await admin
      .from("time_entries")
      .upsert(payload, { onConflict: "toggl_id" });
    if (writeErr) {
      console.error("[toggl-sync] time_entry write failed", { togglId, err: writeErr.message });
      continue;
    }
    counts.entries.upserted++;
  }
}

async function fetchEntriesViaMe(start: string, end: string): Promise<TogglEntry[]> {
  // /me/time_entries is capped to ~3 months; fine for incremental.
  const url = `${TOGGL_API_BASE}/me/time_entries?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`;
  const res = await togglFetch(url);
  return (await res.json()) as TogglEntry[];
}

async function fetchEntriesViaReports(
  workspaceId: number,
  startDate: string,
  endDate: string,
): Promise<TogglEntry[]> {
  // Reports v3 paginates with first_row_number; page size 50 (max for search/time_entries).
  const all: TogglEntry[] = [];
  let firstRowNumber: number | undefined = undefined;
  for (let i = 0; i < 200; i++) {  // hard cap: 10k entries per backfill run
    const body: Record<string, unknown> = {
      start_date: startDate.slice(0, 10),
      end_date: endDate.slice(0, 10),
      page_size: 50,
      order_by: "date",
      order_dir: "ASC",
    };
    if (firstRowNumber) body.first_row_number = firstRowNumber;

    const res = await togglFetch(`${TOGGL_REPORTS_BASE}/workspace/${workspaceId}/search/time_entries`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const nextRow = res.headers.get("X-Next-Row-Number");
    const page = (await res.json()) as Array<{
      user_id: number;
      project_id: number | null;
      description: string;
      billable: boolean;
      time_entries: Array<{ id: number; start: string; stop: string; seconds: number; at: string }>;
      tag_ids?: number[];
    }>;

    for (const group of page ?? []) {
      for (const te of group.time_entries) {
        all.push({
          id: te.id,
          user_id: group.user_id,
          project_id: group.project_id,
          description: group.description,
          billable: group.billable,
          start: te.start,
          stop: te.stop,
          duration: te.seconds,
          at: te.at,
        });
      }
    }

    if (!nextRow) break;
    firstRowNumber = Number(nextRow);
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  if (!TOGGL_API_TOKEN) {
    return json(
      { ok: false, error: "TOGGL_API_TOKEN is not configured. Set it via Supabase project secrets." },
      500,
    );
  }

  // Authenticate: either an admin JWT, or a cron with TOGGL_CRON_SECRET header.
  const cronHeader = req.headers.get("x-cron-secret");
  const isCron = !!CRON_SECRET && !!cronHeader && timingSafeCompare(cronHeader, CRON_SECRET);
  let triggeredBy: string | null = null;

  // The service-role admin client is needed both for the role lookup (so RLS
  // can't hide an admin's own profile and cause a false 403) and for the
  // sync writes below. Hoist its construction above the auth gate.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!isCron) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Missing Authorization header" }, 401);
    }
    const jwt = authHeader.slice(7);
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !authUser) return json({ ok: false, error: "Invalid token" }, 401);

    // Match the rest of the codebase — use user_profiles.role (the
    // authoritative role column) via the service-role client. The previous
    // version queried team_members via the JWT-scoped client, which let a
    // missing team_members row or restrictive RLS lock real admins out.
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role")
      .eq("id", authUser.id)
      .maybeSingle();
    if (profile?.role !== "admin") return json({ ok: false, error: "Admin only" }, 403);
    triggeredBy = authUser.id;
  }

  // Load settings.
  const { data: settings } = await admin
    .from("toggl_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (!settings) {
    return json({ ok: false, error: "toggl_settings is empty — open the Toggl Sync admin page first" }, 400);
  }
  if (settings.enabled === false) {
    return json({ ok: false, error: "Toggl sync is disabled in settings" }, 400);
  }
  if (!settings.workspace_id) {
    return json({ ok: false, error: "workspace_id not set in toggl_settings" }, 400);
  }

  const body = await req.json().catch(() => ({}));
  const trigger = isCron ? "cron" : (body.trigger as string) ?? "manual";
  const backfillFrom: string | null = body.backfill_from ?? settings.backfill_from ?? null;

  // Open run row.
  const { data: runRow } = await admin
    .from("toggl_sync_runs")
    .insert({
      status: "running",
      trigger,
      triggered_by: triggeredBy,
      range_from: backfillFrom,
    })
    .select("id")
    .single();

  // Mark settings running.
  await admin.from("toggl_settings").update({ last_sync_status: "running" }).eq("id", settings.id);

  const counts = emptyCounts();
  const now = new Date();
  const rangeTo = now.toISOString();
  // Incremental window must span calendar dates, not just elapsed time:
  // Reports v3 filters by entry start_date (not updated_at), so any edit
  // to an older entry — backfilling Friday's timer on Monday, fixing a
  // forgotten stop time — sits outside a 5-minute or 24-hour window and
  // is silently dropped. Use a rolling 14-day catch window so backdated
  // edits land. Operators can still trigger a wider backfill explicitly.
  const INCREMENTAL_DAYS = 14;
  const defaultFrom = new Date(now.getTime() - INCREMENTAL_DAYS * 24 * 60 * 60_000).toISOString();
  const rangeFrom = backfillFrom
    ? new Date(`${backfillFrom}T00:00:00Z`).toISOString()
    : defaultFrom;
  const useReports = !!backfillFrom;

  try {
    await syncClients(admin, Number(settings.workspace_id), counts);
    const projectMap = await syncProjects(admin, Number(settings.workspace_id), counts);
    const userMap = await syncUsers(admin, Number(settings.workspace_id), counts);
    // Workspace timezone for bucketing entry date/start_time/end_time —
    // toggl_settings.timezone if set, else America/Chicago (HD's working TZ).
    // Validate the IANA zone first: Intl.DateTimeFormat throws RangeError on
    // unknown zones, which would abort the entire sync at the first entry. A
    // stale/typo'd value in toggl_settings.timezone shouldn't take the cron
    // down — fall back to the default and log so it gets noticed.
    let workspaceTz = (settings.timezone as string) || "America/Chicago";
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: workspaceTz });
    } catch {
      console.warn(
        `[toggl-sync] invalid toggl_settings.timezone "${workspaceTz}" — falling back to America/Chicago`,
      );
      workspaceTz = "America/Chicago";
    }
    await syncTimeEntries(
      admin,
      Number(settings.workspace_id),
      projectMap,
      userMap,
      { from: rangeFrom, to: rangeTo, useReports },
      counts,
      workspaceTz,
    );

    const patch: Record<string, unknown> = {
      last_sync_at: now.toISOString(),
      last_sync_status: "ok",
      last_sync_error: null,
      last_sync_summary: counts,
    };
    // Clear backfill_from after a successful backfill so next run is incremental.
    if (settings.backfill_from && !body.backfill_from) patch.backfill_from = null;
    await admin.from("toggl_settings").update(patch).eq("id", settings.id);

    if (runRow) {
      await admin
        .from("toggl_sync_runs")
        .update({
          status: "ok",
          finished_at: new Date().toISOString(),
          range_from: rangeFrom.slice(0, 10),
          range_to: rangeTo.slice(0, 10),
          summary: counts,
        })
        .eq("id", runRow.id);
    }

    return json({ ok: true, counts, range: { from: rangeFrom, to: rangeTo, useReports } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("toggl_settings")
      .update({
        last_sync_status: "error",
        last_sync_error: message,
        last_sync_summary: counts,
      })
      .eq("id", settings.id);
    if (runRow) {
      await admin
        .from("toggl_sync_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          summary: counts,
          error: message,
        })
        .eq("id", runRow.id);
    }
    return json({ ok: false, error: message, counts }, 500);
  }
});
