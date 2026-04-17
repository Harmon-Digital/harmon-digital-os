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

export function createCrudTools(tableName: string, label: string): CrudToolDefs[] {
  return [
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
          if (value !== undefined && value !== null) {
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
        const { data, error } = await client
          .from(tableName)
          .insert(args.record as Record<string, unknown>)
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
        const { data, error } = await client
          .from(tableName)
          .update(args.updates as Record<string, unknown>)
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
        const { error } = await client
          .from(tableName)
          .delete()
          .eq("id", args.id as string);
        if (error) throw new Error(sanitizeError(error));
        return { deleted: true, id: args.id };
      },
    },

    // SEARCH
    {
      name: `search_${tableName}`,
      description: `Search ${label} records by text (searches common text columns)`,
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

        // Sanitize query: strip characters that could break PostgREST filter syntax
        const safeQ = q.replace(/[%_.*(),\\]/g, "");
        if (!safeQ) throw new Error("Search query contains only special characters");

        const { data, error } = await client
          .from(tableName)
          .select("*")
          .or(`name.ilike.%${safeQ}%,title.ilike.%${safeQ}%,description.ilike.%${safeQ}%,full_name.ilike.%${safeQ}%,company_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%`)
          .limit(limit);

        if (error) throw new Error(sanitizeError(error));
        return { data, count: data?.length || 0 };
      },
    },
  ];
}
