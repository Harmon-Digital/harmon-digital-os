import type { SupabaseClient } from "@supabase/supabase-js";

interface CrudToolDefs {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, client: SupabaseClient) => Promise<unknown>;
}

// Columns that must never be filterable or sortable
const BLOCKED_COLUMNS = new Set([
  "key_hash", "key_prefix", "password_hash", "password", "secret",
  "api_key", "token", "access_token", "refresh_token", "service_role_key",
  "encrypted_password", "confirmation_token", "recovery_token",
]);

// Only allow simple alphanumeric + underscore column names
const SAFE_COLUMN_RE = /^[a-z][a-z0-9_]{0,62}$/;

function validateColumn(col: string): string {
  const clean = col.replace(/^-/, "");
  if (!SAFE_COLUMN_RE.test(clean)) {
    throw new Error(`Invalid column name: ${clean}`);
  }
  if (BLOCKED_COLUMNS.has(clean)) {
    throw new Error(`Column not allowed for filtering: ${clean}`);
  }
  return col;
}

function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    // Strip internal details — only return the core message
    const msg = err.message || "Unknown error";
    // Remove anything after "Details:" or containing table/schema info
    return msg.split(/\bDetails:/i)[0].trim().slice(0, 200);
  }
  return "Operation failed";
}

// Columns that must never be set or mutated via the generic CRUD tools.
// The DB-side trigger guards `user_profiles.role` explicitly for non-service
// callers, but stripping it here gives a clear "field not allowed" error
// instead of a silent no-op. `id`, `created_at`, `updated_at` are pinned so
// the caller cannot retarget a row or back-date it.
const FORBIDDEN_WRITE_COLUMNS = new Set([
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "password",
  "password_hash",
  "key_hash",
  "key_prefix",
  "service_role_key",
  "encrypted_password",
]);

// Extra per-table restrictions for fields that should only flow through
// system code (triggers, edge functions with service role) rather than
// arbitrary MCP callers under JWT auth.
const TABLE_FORBIDDEN_COLUMNS: Record<string, string[]> = {
  user_profiles: ["role"],
  invoices: ["paid_at"],
  tasks: ["completed_at"],
  leads: ["won_at"],
  notifications: ["dedupe_key"],
};

export function sanitizeWritePayload(
  table: string,
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!payload || typeof payload !== "object") return out;
  const extra = TABLE_FORBIDDEN_COLUMNS[table] ?? [];
  for (const [k, v] of Object.entries(payload)) {
    if (FORBIDDEN_WRITE_COLUMNS.has(k)) continue;
    if (extra.includes(k)) continue;
    out[k] = v;
  }
  return out;
}

export function createCrudTools(
  tableName: string,
  label: string,
  searchColumns: string[] = [],
): CrudToolDefs[] {
  const tools: CrudToolDefs[] = [
    // LIST
    {
      name: `list_${tableName}`,
      description: `List ${label} records with optional sorting, limit, and offset`,
      inputSchema: {
        type: "object",
        properties: {
          order_by: {
            type: "string",
            description: "Column to sort by. Prefix with - for descending (default: -created_at)",
          },
          limit: { type: "number", description: "Max records to return (default: 50, max: 200)" },
          offset: { type: "number", description: "Number of records to skip (default: 0)" },
        },
      },
      handler: async (args, client) => {
        const orderBy = validateColumn((args.order_by as string) || "-created_at");
        const isDesc = orderBy.startsWith("-");
        const column = isDesc ? orderBy.slice(1) : orderBy;
        const limit = Math.min(Math.max((args.limit as number) || 50, 1), 200);
        const offset = Math.max((args.offset as number) || 0, 0);

        let query = client.from(tableName).select("*", { count: "exact" });
        query = query.order(column, { ascending: !isDesc });
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;
        if (error) throw new Error(sanitizeError(error));
        return { data, total: count };
      },
    },

    // GET
    {
      name: `get_${tableName}`,
      description: `Get a single ${label} record by ID`,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Record UUID" },
        },
        required: ["id"],
      },
      handler: async (args, client) => {
        const { data, error } = await client
          .from(tableName)
          .select("*")
          .eq("id", args.id as string)
          .single();
        if (error) throw new Error(sanitizeError(error));
        return data;
      },
    },

    // FILTER
    {
      name: `filter_${tableName}`,
      description: `Filter ${label} records by field=value pairs`,
      inputSchema: {
        type: "object",
        properties: {
          filters: {
            type: "object",
            description: "Key-value pairs to filter by (exact match). Example: {\"status\": \"active\"}",
            additionalProperties: true,
          },
          order_by: { type: "string", description: "Sort column (prefix - for desc, default: -created_at)" },
          limit: { type: "number", description: "Max records (default: 50, max: 200)" },
        },
        required: ["filters"],
      },
      handler: async (args, client) => {
        const filters = args.filters as Record<string, unknown>;
        const orderBy = validateColumn((args.order_by as string) || "-created_at");
        const isDesc = orderBy.startsWith("-");
        const column = isDesc ? orderBy.slice(1) : orderBy;
        const limit = Math.min(Math.max((args.limit as number) || 50, 1), 200);

        let query = client.from(tableName).select("*", { count: "exact" });

        for (const [key, value] of Object.entries(filters)) {
          // Skip empty strings — a "" filter is the "All" selector across the
          // SPA (src/api/supabaseEntities.js); passing it to .eq returns no
          // rows. The MCP must match that semantic or callers get drift.
          if (value !== undefined && value !== null && value !== "") {
            validateColumn(key);
            query = query.eq(key, value);
          }
        }

        query = query.order(column, { ascending: !isDesc });
        query = query.limit(limit);

        const { data, error, count } = await query;
        if (error) throw new Error(sanitizeError(error));
        return { data, total: count };
      },
    },

    // CREATE
    {
      name: `create_${tableName}`,
      description: `Create a new ${label} record`,
      inputSchema: {
        type: "object",
        properties: {
          record: {
            type: "object",
            description: `Fields for the new ${label} record`,
            additionalProperties: true,
          },
        },
        required: ["record"],
      },
      handler: async (args, client) => {
        const safeRecord = sanitizeWritePayload(tableName, args.record as Record<string, unknown>);
        const { data, error } = await client
          .from(tableName)
          .insert(safeRecord)
          .select()
          .single();
        if (error) throw new Error(sanitizeError(error));
        return data;
      },
    },

    // UPDATE
    {
      name: `update_${tableName}`,
      description: `Update a ${label} record by ID`,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Record UUID" },
          updates: {
            type: "object",
            description: "Fields to update",
            additionalProperties: true,
          },
        },
        required: ["id", "updates"],
      },
      handler: async (args, client) => {
        const safeUpdates = sanitizeWritePayload(tableName, args.updates as Record<string, unknown>);
        const { data, error } = await client
          .from(tableName)
          .update(safeUpdates)
          .eq("id", args.id as string)
          .select()
          .single();
        if (error) throw new Error(sanitizeError(error));
        return data;
      },
    },

    // DELETE
    {
      name: `delete_${tableName}`,
      description: `Delete a ${label} record by ID`,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Record UUID" },
        },
        required: ["id"],
      },
      handler: async (args, client) => {
        // `.delete()` returns {error: null} when zero rows match — whether
        // the id is wrong, the row was already deleted, or RLS hides it.
        // Every other verb here uses `.single()` to surface "no rows" as an
        // error; delete was silently reporting success. Force the returning
        // set so a 0-row outcome is distinguishable.
        const { data, error } = await client
          .from(tableName)
          .delete()
          .eq("id", args.id as string)
          .select("id");
        if (error) throw new Error(sanitizeError(error));
        if (!data || data.length === 0) {
          throw new Error("Record not found or not permitted to delete");
        }
        return { deleted: true, id: args.id };
      },
    },

  ];

  // SEARCH — only register for tables that have searchable text columns
  if (searchColumns.length > 0) {
    // Validate the allowlist at registration time so a typo in the registry
    // fails loudly instead of producing 400s at query time.
    searchColumns.forEach(validateColumn);
    tools.push({
      name: `search_${tableName}`,
      description: `Search ${label} records by text in columns: ${searchColumns.join(", ")}`,
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search text" },
          limit: { type: "number", description: "Max records (default: 20, max: 100)" },
        },
        required: ["query"],
      },
      handler: async (args, client) => {
        const q = (args.query as string || "").trim();
        if (!q) throw new Error("Search query cannot be empty");
        const limit = Math.min(Math.max((args.limit as number) || 20, 1), 100);

        // Strip characters that could break PostgREST filter syntax —
        // % _ are wildcards, , : are or() separators, ( ) wrap groups,
        // . is the operator separator, * is reserved, \ is escape.
        const safeQ = q.replace(/[%_.*(),:\\]/g, "");
        if (!safeQ) throw new Error("Search query contains only special characters");

        const orFilter = searchColumns.map((c) => `${c}.ilike.%${safeQ}%`).join(",");
        const { data, error } = await client
          .from(tableName)
          .select("*")
          .or(orFilter)
          .limit(limit);

        if (error) throw new Error(sanitizeError(error));
        return { data, count: data?.length || 0 };
      },
    });
  }

  return tools;
}
