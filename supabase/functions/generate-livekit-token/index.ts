import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function buildLivekitToken({
  apiKey,
  apiSecret,
  identity,
  name,
  roomName,
  ttlSeconds = 60 * 60 * 4,
}: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name?: string;
  roomName: string;
  ttlSeconds?: number;
}) {
  // LiveKit JWT claims
  // https://docs.livekit.io/realtime/concepts/authentication/
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    iss: apiKey,
    sub: identity,
    iat: now,
    nbf: now,
    exp: getNumericDate(ttlSeconds),
    name: name || identity,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  // Convert API secret to a CryptoKey for HS256 signing
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  return await create({ alg: "HS256", typ: "JWT" }, payload, key);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return new Response(
      JSON.stringify({ error: "LIVEKIT credentials not configured on server" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  // Verify caller's JWT
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing auth" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid auth" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let payload: { roomName?: string; channelId?: string; identity?: string; name?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { roomName, channelId, identity, name } = payload;
  if (!roomName || !channelId) {
    return new Response(
      JSON.stringify({ error: "roomName and channelId required" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  // Verify caller has access to channel (RLS check)
  const { data: channel } = await supabase
    .from("chat_channels")
    .select("id")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) {
    return new Response(
      JSON.stringify({ error: "Channel not accessible" }),
      { status: 403, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  try {
    const token = await buildLivekitToken({
      apiKey: LIVEKIT_API_KEY,
      apiSecret: LIVEKIT_API_SECRET,
      identity: identity || user.id,
      name: name || user.email || "User",
      roomName,
    });

    return new Response(
      JSON.stringify({ token, url: LIVEKIT_URL }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Token generation failed:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Token generation failed" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
