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

  // Create the partner user via admin API (does not affect caller session)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: contactName },
  });
  if (createErr || !created?.user) {
    return new Response(JSON.stringify({ error: createErr?.message || "Failed to create user" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const newUserId = created.user.id;

  // Create user profile with partner role
  const { error: profileErr } = await admin.from("user_profiles").upsert(
    { id: newUserId, email, full_name: contactName, role: "partner" },
    { onConflict: "id" }
  );
  if (profileErr) {
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
