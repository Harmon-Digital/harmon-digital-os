import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserClient, createServiceClient } from "./supabase.ts";

const MCP_API_KEY = Deno.env.get("MCP_API_KEY");

export interface AuthContext {
  client: SupabaseClient;
  mode: "jwt" | "apikey";
}

async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function authenticate(req: Request): Promise<AuthContext> {
  // Check API key first
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    // Check against DB keys first
    const keyHash = await hashKey(apiKey);
    const serviceClient = createServiceClient();

    const { data } = await serviceClient
      .from("mcp_api_keys")
      .select("id")
      .eq("key_hash", keyHash)
      .eq("revoked", false)
      .maybeSingle();

    if (data) {
      // Valid DB key — update last_used_at in background
      serviceClient
        .from("mcp_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id)
        .then(() => {});
      return { client: serviceClient, mode: "apikey" };
    }

    // Fallback to env var for backward compatibility
    if (MCP_API_KEY && apiKey === MCP_API_KEY) {
      return { client: serviceClient, mode: "apikey" };
    }

    throw new AuthError("Invalid API key", 401);
  }

  // Fall back to JWT
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError(
      "Missing authentication. Provide Authorization: Bearer <jwt> or X-API-Key: <key>",
      401
    );
  }

  const jwt = authHeader.slice(7);
  return { client: createUserClient(jwt), mode: "jwt" };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
