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

async function timingSafeCompare(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) {
    const pad = new Uint8Array(aBytes.length);
    await crypto.subtle.timingSafeEqual(aBytes, pad);
    return false;
  }
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

export async function authenticate(req: Request): Promise<AuthContext> {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const keyHash = await hashKey(apiKey);
    const serviceClient = createServiceClient();

    const { data } = await serviceClient
      .from("mcp_api_keys")
      .select("id")
      .eq("key_hash", keyHash)
      .eq("revoked", false)
      .maybeSingle();

    if (data) {
      serviceClient
        .from("mcp_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id)
        .then(() => {})
        .catch((err: unknown) => console.error("Failed to update last_used_at:", err));
      return { client: serviceClient, mode: "apikey" };
    }

    if (MCP_API_KEY && await timingSafeCompare(apiKey, MCP_API_KEY)) {
      return { client: serviceClient, mode: "apikey" };
    }

    throw new AuthError("Invalid API key", 401);
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError(
      "Missing authentication. Provide Authorization: Bearer <jwt> or X-API-Key: <key>",
      401
    );
  }

  const jwt = authHeader.slice(7);
  const client = createUserClient(jwt);

  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    throw new AuthError("Invalid or expired JWT token", 401);
  }

  return { client, mode: "jwt" };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
