/**
 * partner-self-signup — Public, unauthenticated endpoint for partner signups.
 *
 * The previous self-serve signup flow ran client-side: it called
 * supabase.auth.signUp() and then *the client* upserted user_profiles with
 * `role: "partner"`. With the existing user_profiles RLS (which only
 * constrains `id = auth.uid()` and has no check on the role column), that
 * meant any authenticated user could promote themselves to any role —
 * including admin — at will.
 *
 * The role guard trigger added in 20260601 closes the underlying hole at
 * the DB layer: client-side INSERTs/UPDATEs of `role` get forced back to
 * a safe default. Legitimate partner signups now have to flow through here,
 * where the service-role key bypasses the trigger and assigns the correct
 * role server-side.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: {
    email?: string;
    password?: string;
    contactName?: string;
    companyName?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { email, password, contactName, companyName } = payload;
  if (!email || !password || !contactName) {
    return json({ error: "email, password, and contactName are required" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Invalid email format" }, 400);
  }
  if (password.length < 6) {
    return json({ error: "Password must be at least 6 characters" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Create the auth user. `email_confirm: false` triggers a confirmation
  // email via the project's auth settings, matching the prior client-side
  // signUp behaviour. Use createUser (not inviteUserByEmail) because the
  // partner has chosen their own password here.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name: contactName },
  });
  if (createErr || !created?.user) {
    // Don't leak Supabase auth error messages (e.g. "User already registered",
    // "Email rate limit exceeded") to an unauthenticated caller — that's a
    // textbook user-enumeration oracle. Log the real reason server-side.
    console.warn("[partner-self-signup] createUser failed:", createErr?.message);
    return json({
      error: "Could not create account. If you already have one, sign in instead.",
    }, 400);
  }

  const newUserId = created.user.id;

  // Assign the partner role server-side. Service-role bypasses the role
  // guard trigger added in migration 20260601.
  const { error: profileErr } = await admin.from("user_profiles").upsert(
    { id: newUserId, email, full_name: contactName, role: "partner" },
    { onConflict: "id" },
  );
  if (profileErr) {
    // Same enumeration concern as createUser above — never echo the raw
    // Postgres error to an unauthenticated caller.
    console.warn("[partner-self-signup] profile upsert failed:", profileErr.message);
    await admin.auth.admin.deleteUser(newUserId).catch(() => {});
    return json({ error: "Could not create account. Please try again." }, 500);
  }

  // Create the referral_partners record (mirrors the original client-side flow).
  const { data: partnerData, error: partnerErr } = await admin
    .from("referral_partners")
    .insert({
      user_id: newUserId,
      contact_name: contactName,
      company_name: companyName || null,
      email,
    })
    .select()
    .single();
  if (partnerErr) {
    // A unique-email constraint on referral_partners is itself an
    // enumeration oracle if echoed back — keep the response generic.
    console.warn("[partner-self-signup] partner insert failed:", partnerErr.message);
    await admin.from("user_profiles").delete().eq("id", newUserId);
    await admin.auth.admin.deleteUser(newUserId).catch(() => {});
    return json({ error: "Could not create account. Please try again." }, 500);
  }

  // Link to brokers table if there's an existing row with this email
  // (mirrors original client-side behaviour — partner signing up via an
  // earlier broker-outreach contact). Use limit(1) instead of maybeSingle()
  // so multiple broker rows with the same email don't error out and cause
  // a duplicate broker insert below.
  if (partnerData) {
    const { data: brokerMatches } = await admin
      .from("brokers")
      .select("id, status")
      .eq("email", email)
      .limit(1);
    const existingBroker = brokerMatches?.[0];

    if (existingBroker) {
      await admin
        .from("brokers")
        .update({
          status: "signed_up",
          partner_id: partnerData.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingBroker.id);
    } else {
      await admin.from("brokers").insert({
        name: contactName,
        firm: companyName || "",
        email,
        status: "signed_up",
        partner_id: partnerData.id,
      });
    }
  }

  return json({ success: true, userId: newUserId, email });
});
