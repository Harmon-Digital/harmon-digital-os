/**
 * chat-relay — Harmon Digital OS → OpenClaw bridge
 *
 * POST /functions/v1/chat-relay
 * Body: { message, agent_id, channel_id, agent_type, account_id? }
 *
 * Flow:
 *   1. Validate request
 *   2. Insert user message into bot_messages
 *   3. Fire POST to OpenClaw /hooks/agent (async — 202 response)
 *   4. Return { ok: true, message_id }
 *
 * The OS listens via Supabase Realtime for the assistant reply,
 * which Harmon Bot writes back to bot_messages after processing.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENCLAW_HOOK_URL = Deno.env.get("OPENCLAW_HOOK_URL") ?? "https://bot.harmon-digital.com/hooks/agent";
const OPENCLAW_HOOK_TOKEN = Deno.env.get("OPENCLAW_HOOK_TOKEN")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Authenticate: verify JWT from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.slice(7);
    const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { message, agent_id, channel_id, agent_type, account_id } = body;
    // Use authenticated user's ID instead of trusting client-supplied user_id
    const user_id = authUser.id;

    // Validate required fields
    if (!message?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof message !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "message must be a string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Cap message size. Without this, a caller can post a multi-MB string
    // that fans out through bot_messages → Supabase Realtime to every
    // subscribed client and is forwarded to OpenClaw — a cheap amplification
    // and isolate-memory pressure vector. 16 KB is generous for chat; the
    // upstream LLM context window caps usable input far below this anyway.
    if (message.length > 16_000) {
      return new Response(
        JSON.stringify({ ok: false, error: "message too long (max 16000 chars)" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!channel_id || !user_id) {
      return new Response(JSON.stringify({ ok: false, error: "channel_id and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agentId = agent_id ?? "harmon-bot-core";

    // Verify the caller can see the channel before writing to it.
    // Using the user-scoped client here so RLS enforces membership.
    const { data: channel, error: channelErr } = await authClient
      .from("bot_channels")
      .select("id")
      .eq("id", channel_id)
      .maybeSingle();
    if (channelErr || !channel) {
      return new Response(JSON.stringify({ ok: false, error: "Channel not found or access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate account_id against the caller's RLS-scoped view of accounts.
    // Without this, a signed-in user could pin any account_id to the message
    // metadata and the downstream bot would scope reads/actions to that
    // account in the user's chat thread.
    let scopedAccountId: string | null = null;
    if (account_id) {
      const { data: acct, error: acctErr } = await authClient
        .from("accounts")
        .select("id")
        .eq("id", account_id)
        .maybeSingle();
      if (acctErr || !acct) {
        return new Response(JSON.stringify({ ok: false, error: "Account not accessible" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      scopedAccountId = acct.id;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Insert user message
    const { data: msgData, error: msgError } = await supabase
      .from("bot_messages")
      .insert({
        channel_id,
        role: "user",
        user_id,
        content: message.trim(),
        metadata: {
          source: "harmon-digital-os",
          agent_id: agentId,
          agent_type: agent_type ?? "core",
          account_id: scopedAccountId,
        },
      })
      .select("id")
      .single();

    if (msgError) {
      console.error("Failed to insert message:", msgError);
      return new Response(JSON.stringify({ ok: false, error: "Failed to save message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fire OpenClaw hook (async — do not await response body)
    //    Session key is "os:<agent_id>:<user_id>" for isolation per user+agent
    const sessionKey = `os:${agentId}:${user_id}`;

    const hookPayload = {
      message: message.trim(),
      name: "Harmon Digital OS",
      agentId: "main",
      sessionKey,
      wakeMode: "now",
      deliver: false,
    };

    // Include routing context in a system note so I know where to write the reply
    const contextNote = `\n\n[OS_CONTEXT channel_id=${channel_id} agent_id=${agentId} user_message_id=${msgData.id}]`;

    const hookBody = {
      ...hookPayload,
      message: message.trim() + contextNote,
    };

    // Edge Function isolates terminate as soon as the response is returned,
    // so a true fire-and-forget fetch may never actually leave the isolate.
    // EdgeRuntime.waitUntil keeps the isolate alive until the hook call
    // completes (the hook itself still returns 202; reply comes via Realtime).
    // Bound the upstream call. Without a timeout, a stalled OpenClaw (slow
    // DNS, hung TLS handshake, half-open TCP) keeps the isolate alive via
    // waitUntil for the full ~150s Edge Function ceiling — amplifying any
    // load against this relay. 8 s is generous for a 202-style hook.
    const hookCall = fetch(OPENCLAW_HOOK_URL, {
      method: "POST",
      signal: AbortSignal.timeout(8_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENCLAW_HOOK_TOKEN}`,
        "x-openclaw-token": OPENCLAW_HOOK_TOKEN,
      },
      body: JSON.stringify(hookBody),
    }).catch((err) => {
      // Log only the message — error objects from fetch can stringify the
      // full Request including headers, which would leak OPENCLAW_HOOK_TOKEN
      // into log aggregators (Sentry, Datadog, etc.).
      console.error(
        "OpenClaw hook error:",
        err instanceof Error ? err.message : "fetch failed",
      );
    });
    // deno-lint-ignore no-explicit-any
    const er = (globalThis as any).EdgeRuntime;
    if (er?.waitUntil) er.waitUntil(hookCall);
    else await hookCall;

    return new Response(
      JSON.stringify({ ok: true, message_id: msgData.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("chat-relay error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
