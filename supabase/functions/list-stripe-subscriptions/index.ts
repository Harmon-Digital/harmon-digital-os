import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

// Must mirror stripe-webhook / sync-stripe-data. JPY/KRW/etc are stored in
// major units by Stripe; dividing by 100 misreports them at 1/100 of value.
const ZERO_DECIMAL = new Set([
  "jpy","krw","vnd","clp","pyg","ugx","xaf","xof","kmf","djf","gnf","rwf","mga","bif",
]);
const minorToMajor = (amount: number | null | undefined, currency: string | null | undefined) => {
  if (amount == null) return null;
  const cur = (currency || "").toLowerCase();
  const div = ZERO_DECIMAL.has(cur) ? 1 : 100;
  return (Number(amount) || 0) / div;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!STRIPE_SECRET_KEY) return json({ success: false, error: "STRIPE_SECRET_KEY not configured" }, 500);

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);

  const authed = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await authed.auth.getUser();
  if (error || !user) return json({ error: "Invalid auth" }, 401);

  // Admins/team only — Stripe subscription list leaks customer info across clients.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: profile } = await admin
    .from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "team"].includes(profile.role)) {
    return json({ error: "Admins only" }, 403);
  }

  try {
    const res = await fetch(
      "https://api.stripe.com/v1/subscriptions?limit=100&status=all&expand[]=data.customer",
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
    );
    if (!res.ok) throw new Error(`Stripe subscriptions failed (${res.status})`);
    const body = await res.json();
    const subscriptions = (body.data || []).map((s: any) => {
      const item = s.items?.data?.[0];
      const price = item?.price;
      // Stripe API ≥2024-09-30 moved current_period_end onto the line item.
      // Read item first, fall back to the (legacy) subscription root.
      const periodEnd = item?.current_period_end ?? s.current_period_end ?? null;
      return {
        id: s.id,
        customer: typeof s.customer === "object" ? s.customer.id : s.customer,
        customer_name: typeof s.customer === "object" ? s.customer.name : null,
        customer_email: typeof s.customer === "object" ? s.customer.email : null,
        status: s.status,
        amount: minorToMajor(price?.unit_amount, price?.currency),
        currency: price?.currency || null,
        interval: price?.recurring?.interval || null,
        current_period_end: periodEnd,
      };
    });
    return json({ success: true, subscriptions });
  } catch (err) {
    console.error("[list-stripe-subscriptions]", err);
    return json({ success: false, error: err instanceof Error ? err.message : "Failed" }, 500);
  }
});
