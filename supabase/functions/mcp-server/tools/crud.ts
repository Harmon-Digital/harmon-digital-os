import type { SupabaseClient } from "@supabase/supabase-js";

interface CrudToolDefs {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, client: SupabaseClient) => Promise<unknown>;
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
          limit: { type: "number", description: "Max records to return (default: 50)" },
          offset: { type: "number", description: "Number of records to skip (default: 0)" },
        },
      },
      handler: async (args, client) => {
        const orderBy = (args.order_by as string) || "-created_at";
        const isDesc = orderBy.startsWith("-");
        const column = isDesc ? orderBy.slice(1) : orderBy;
        const limit = (args.limit as number) || 50;
        const offset = (args.offset as number) || 0;

        let query = client.from(tableName).select("*", { count: "exact" });
        query = query.order(column, { ascending: !isDesc });
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;
        if (error) throw error;
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
        if (error) throw error;
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
          limit: { type: "number", description: "Max records (default: 50)" },
        },
        required: ["filters"],
      },
      handler: async (args, client) => {
        const filters = args.filters as Record<string, unknown>;
        const orderBy = (args.order_by as string) || "-created_at";
        const isDesc = orderBy.startsWith("-");
        const column = isDesc ? orderBy.slice(1) : orderBy;
        const limit = (args.limit as number) || 50;

        let query = client.from(tableName).select("*", { count: "exact" });

        for (const [key, value] of Object.entries(filters)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        }

        query = query.order(column, { ascending: !isDesc });
        query = query.limit(limit);

        const { data, error, count } = await query;
        if (error) throw error;
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
        if (error) throw error;
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
        if (error) throw error;
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
        if (error) throw error;
        return { deleted: true, id: args.id };
      },
    },
  ];
}
