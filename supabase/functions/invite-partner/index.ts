import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing auth" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Verify caller is an admin
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid auth" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: callerProfile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (callerProfile?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let payload: { email?: string; contactName?: string; companyName?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { email, contactName, companyName } = payload;
  if (!email || !contactName) {
    return new Response(JSON.stringify({ error: "email and contactName required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email format" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const APP_ORIGIN = Deno.env.get("APP_ORIGIN") || "https://os.harmon-digital.com";

  // Invite the partner via the admin invite API — Supabase sends the invite
  // email using the configured SMTP/auth settings. createUser with a random
  // password gave the partner verified credentials they never received.
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${APP_ORIGIN}/login`,
    data: { full_name: contactName, role: "partner" },
  });
  if (inviteErr || !invited?.user) {
    return new Response(JSON.stringify({ error: inviteErr?.message || "Failed to invite user" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const newUserId = invited.user.id;

  // Create user profile with partner role
  const { error: profileErr } = await admin.from("user_profiles").upsert(
    { id: newUserId, email, full_name: contactName, role: "partner" },
    { onConflict: "id" }
  );
  if (profileErr) {
    // Roll back the auth user so retries don't accumulate orphans.
    await admin.auth.admin.deleteUser(newUserId).catch(() => {});
    return new Response(JSON.stringify({ error: profileErr.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Create referral_partners record
  const { error: partnerErr } = await admin.from("referral_partners").insert({
    user_id: newUserId,
    contact_name: contactName,
    company_name: companyName || null,
    email,
  });
  if (partnerErr) {
    // Roll back auth user + profile.
    // PostgrestFilterBuilder is a PromiseLike, not a real Promise — its
    // .catch may be missing (and optional chain would silently swallow it),
    // so wrap with Promise.resolve to get a real Promise we can await.
    await Promise.resolve(
      admin.from("user_profiles").delete().eq("id", newUserId)
    ).catch(() => {});
    await admin.auth.admin.deleteUser(newUserId).catch(() => {});
    return new Response(JSON.stringify({ error: partnerErr.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ success: true, userId: newUserId, email }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
