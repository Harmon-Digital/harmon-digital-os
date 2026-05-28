import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

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

  try {
    const res = await fetch(
      "https://api.stripe.com/v1/subscriptions?limit=100&status=all&expand[]=data.customer",
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
    );
    if (!res.ok) throw new Error(`Stripe subscriptions failed (${res.status})`);
    const body = await res.json();
    const subscriptions = (body.data || []).map((s: any) => {
      const price = s.items?.data?.[0]?.price;
      return {
        id: s.id,
        customer: typeof s.customer === "object" ? s.customer.id : s.customer,
        customer_name: typeof s.customer === "object" ? s.customer.name : null,
        customer_email: typeof s.customer === "object" ? s.customer.email : null,
        status: s.status,
        amount: price?.unit_amount != null ? price.unit_amount / 100 : null,
        currency: price?.currency || null,
        interval: price?.recurring?.interval || null,
        current_period_end: s.current_period_end,
      };
    });
    return json({ success: true, subscriptions });
  } catch (err) {
    console.error("[list-stripe-subscriptions]", err);
    return json({ success: false, error: err instanceof Error ? err.message : "Failed" }, 500);
  }
});
