/**
 * chat-relay — Harmon Digital OS → OpenClaw bridge
 *
 * POST /functions/v1/chat-relay
 * Body: { message, agent_id, channel_id, user_id, agent_type, account_id? }
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
    const body = await req.json();
    const { message, agent_id, channel_id, user_id, agent_type, account_id } = body;

    // Validate required fields
    if (!message?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!channel_id || !user_id) {
      return new Response(JSON.stringify({ ok: false, error: "channel_id and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agentId = agent_id ?? "harmon-bot-core";
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
          account_id: account_id ?? null,
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

    // Fire and forget — the hook returns 202, reply comes back via Supabase Realtime
    fetch(OPENCLAW_HOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENCLAW_HOOK_TOKEN}`,
        "x-openclaw-token": OPENCLAW_HOOK_TOKEN,
      },
      body: JSON.stringify(hookBody),
    }).catch((err) => console.error("OpenClaw hook error:", err));

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
