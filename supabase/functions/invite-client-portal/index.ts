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

  let payload: { contactId?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { contactId } = payload;
  if (!contactId) {
    return new Response(JSON.stringify({ error: "contactId required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Load the contact
  const { data: contact, error: contactErr } = await admin
    .from("contacts")
    .select("id, first_name, last_name, email, account_id, portal_user_id")
    .eq("id", contactId)
    .maybeSingle();
  if (contactErr || !contact) {
    return new Response(JSON.stringify({ error: "Contact not found" }), {
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  if (!contact.email) {
    return new Response(JSON.stringify({ error: "Contact has no email" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  if (contact.portal_user_id) {
    return new Response(JSON.stringify({ error: "Contact already has portal access", alreadyInvited: true }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const fullName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || contact.email;
  const appOrigin = Deno.env.get("APP_ORIGIN") || "https://os.harmon-digital.com";

  // Invite via Supabase Auth admin API
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(contact.email, {
    redirectTo: `${appOrigin}/client/login`,
    data: { full_name: fullName, role: "client" },
  });

  if (inviteErr || !invited?.user) {
    console.error("inviteUserByEmail failed:", inviteErr);
    return new Response(JSON.stringify({ error: inviteErr?.message || "Invite failed" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const newUserId = invited.user.id;

  // Create or update the user_profiles row with role=client
  const { error: profileErr } = await admin
    .from("user_profiles")
    .upsert({
      id: newUserId,
      email: contact.email,
      full_name: fullName,
      role: "client",
    }, { onConflict: "id" });
  if (profileErr) console.error("upsert profile failed:", profileErr);

  // Link the contact to the auth user
  await admin
    .from("contacts")
    .update({
      portal_user_id: newUserId,
      portal_invited_at: new Date().toISOString(),
    })
    .eq("id", contactId);

  // Log the invite
  await admin.from("client_invitations").insert({
    contact_id: contactId,
    invited_by: user.id,
    email: contact.email,
  });

  return new Response(
    JSON.stringify({ success: true, userId: newUserId, email: contact.email }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
