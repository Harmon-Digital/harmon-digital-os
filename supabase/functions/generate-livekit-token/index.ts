import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Base64url encode (no padding)
function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signLivekitJwt(
  apiKey: string,
  apiSecret: string,
  identity: string,
  name: string,
  roomName: string,
  ttlSeconds = 60 * 60 * 4,
) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: apiKey,
    sub: identity,
    iat: now,
    nbf: now,
    exp: now + ttlSeconds,
    name,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(signingInput)),
  );
  const sigB64 = b64url(sigBytes);

  return `${signingInput}.${sigB64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  console.log(`[livekit-token] ${req.method} request received`);

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.error("[livekit-token] missing env vars:", {
      url: !!LIVEKIT_URL,
      key: !!LIVEKIT_API_KEY,
      secret: !!LIVEKIT_API_SECRET,
    });
    return new Response(
      JSON.stringify({ error: "LIVEKIT credentials not configured on server" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

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
    console.error("[livekit-token] user verify failed:", userErr?.message);
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
    const token = await signLivekitJwt(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      identity || user.id,
      name || user.email || "User",
      roomName,
    );
    console.log("[livekit-token] success for user", user.id, "room", roomName);
    return new Response(
      JSON.stringify({ token, url: LIVEKIT_URL }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token generation failed";
    console.error("[livekit-token] sign failed:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
