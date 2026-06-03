import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_API = "https://api.stripe.com/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// GET a Stripe list endpoint, paging through all results (cap for safety).
async function stripeList(path: string, params: Record<string, string> = {}) {
  const out: any[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ limit: "100", ...params });
    if (startingAfter) qs.set("starting_after", startingAfter);
    const res = await fetch(`${STRIPE_API}/${path}?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stripe ${path} failed (${res.status}): ${text}`);
    }
    const body = await res.json();
    out.push(...(body.data || []));
    if (!body.has_more || body.data.length === 0) break;
    startingAfter = body.data[body.data.length - 1].id;
  }
  return out;
}

function mapInvoiceStatus(inv: any): string {
  switch (inv.status) {
    case "paid":
      return "paid";
    case "void":
      return "void";
    case "uncollectible":
      return "overdue";
    case "open": {
      const due = inv.due_date ? new Date(inv.due_date * 1000) : null;
      if (due && due.getTime() < Date.now()) return "overdue";
      return "sent";
    }
    default:
      return "draft";
  }
}

const toISODate = (unix?: number | null) =>
  unix ? new Date(unix * 1000).toISOString().slice(0, 10) : null;
const toISO = (unix?: number | null) =>
  unix ? new Date(unix * 1000).toISOString() : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (!STRIPE_SECRET_KEY) {
    return json({ success: false, error: "STRIPE_SECRET_KEY not configured on the server" }, 500);
  }

  // Auth: caller must be a signed-in admin.
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);

  const authed = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userErr } = await authed.auth.getUser();
  if (userErr || !user) return json({ error: "Invalid auth" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: profile } = await admin
    .from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "team"].includes(profile.role)) {
    return json({ error: "Admins only" }, 403);
  }

  let syncType = "all";
  try {
    const body = await req.json();
    syncType = body?.syncType || "all";
  } catch { /* default all */ }

  const want = (t: string) => syncType === "all" || syncType === t;
  const results: Record<string, unknown> = {};

  try {
    /* ---- Products ---- */
    if (want("products")) {
      const products = await stripeList("products", { active: "true" });
      let n = 0;
      for (const p of products) {
        const prices = await stripeList("prices", { product: p.id });
        const { error } = await admin.from("stripe_products").upsert({
          stripe_product_id: p.id,
          name: p.name,
          description: p.description,
          active: p.active,
          prices: prices.map((pr) => ({
            id: pr.id, unit_amount: pr.unit_amount, currency: pr.currency,
            recurring: pr.recurring, nickname: pr.nickname,
          })),
          metadata: p.metadata || {},
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_product_id" });
        if (!error) n++;
      }
      results.products = n;
    }

    /* ---- Customers → map onto accounts/contacts by email ---- */
    if (want("customers")) {
      const customers = await stripeList("customers");
      let linked = 0;
      for (const c of customers) {
        if (!c.email) continue;
        const { data: contact } = await admin
          .from("contacts")
          .select("id, account_id")
          .ilike("email", c.email)
          .maybeSingle();
        if (contact) {
          await admin.from("contacts").update({ stripe_customer_id: c.id }).eq("id", contact.id);
          if (contact.account_id) {
            await admin.from("accounts").update({ stripe_customer_id: c.id }).eq("id", contact.account_id);
          }
          linked++;
        }
      }
      results.customers = { fetched: customers.length, linked };
    }

    /* ---- Subscriptions ---- */
    if (want("subscriptions")) {
      const subs = await stripeList("subscriptions", { status: "all" });
      let n = 0;
      for (const s of subs) {
        const item = s.items?.data?.[0];
        const price = item?.price;
        const { data: acct } = await admin
          .from("accounts").select("id").eq("stripe_customer_id", s.customer).maybeSingle();
        const { error } = await admin.from("stripe_subscriptions").upsert({
          stripe_subscription_id: s.id,
          stripe_customer_id: s.customer,
          stripe_product_id: price?.product || null,
          status: s.status,
          current_period_start: toISO(s.current_period_start),
          current_period_end: toISO(s.current_period_end),
          cancel_at: toISO(s.cancel_at),
          canceled_at: toISO(s.canceled_at),
          amount: price?.unit_amount != null ? price.unit_amount / 100 : null,
          currency: price?.currency || null,
          interval: price?.recurring?.interval || null,
          metadata: { ...(s.metadata || {}), account_id: acct?.id || null },
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_subscription_id" });
        if (!error) n++;
      }
      results.subscriptions = n;
    }

    /* ---- Invoices → local invoices table, matched to account ---- */
    if (want("invoices")) {
      const invoices = await stripeList("invoices");
      let n = 0, unmatched = 0;
      for (const inv of invoices) {
        const { data: acct } = await admin
          .from("accounts").select("id").eq("stripe_customer_id", inv.customer).maybeSingle();
        if (!acct) { unmatched++; }
        const { error } = await admin.from("invoices").upsert({
          stripe_invoice_id: inv.id,
          account_id: acct?.id || null,
          invoice_number: inv.number || null,
          issue_date: toISODate(inv.created),
          due_date: toISODate(inv.due_date),
          status: mapInvoiceStatus(inv),
          subtotal: (inv.subtotal || 0) / 100,
          tax: (inv.tax || 0) / 100,
          total: (inv.total || 0) / 100,
          stripe_invoice_url: inv.hosted_invoice_url || null,
          line_items: (inv.lines?.data || []).map((li: any) => ({
            description: li.description, amount: (li.amount || 0) / 100, quantity: li.quantity,
          })),
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_invoice_id" });
        if (!error) n++;
      }
      results.invoices = { synced: n, unmatched_to_account: unmatched };
    }

    /* ---- Balance transactions → local transactions table ---- */
    if (want("transactions")) {
      // /v1/balance_transactions returns every fund flow in the connected
      // Stripe account: charges, refunds, payouts, adjustments, fees.
      // expand[]=data.source so `source` is an object (customer/invoice/payment_intent
      // ids), not a bare id. Without expansion the type-check below never matches
      // and every transaction ends up with account_id=null.
      const txns = await stripeList("balance_transactions", { "expand[]": "data.source" });
      let n = 0, unmatched = 0;
      // Pre-fetch all accounts so we can map customer/invoice → account_id
      // without an N+1 round trip per transaction.
      const customerLookups = new Map<string, string>();
      for (const t of txns) {
        // Skip non-monetary entries that don't fit our schema.
        if (!t.id) continue;
        // Resolve a customer id from the source object so we can attach the
        // local account. Balance txns embed the related charge/invoice/refund
        // via `source` when expanded — without expansion we only get the id,
        // so we pull from existing data first.
        let stripeCustomerId: string | null = null;
        let stripeInvoiceId: string | null = null;
        let stripePaymentIntentId: string | null = null;
        const src = t.source as string | { id?: string; customer?: string; invoice?: string; payment_intent?: string } | null | undefined;
        if (src && typeof src === "object") {
          stripeCustomerId = src.customer || null;
          stripeInvoiceId = src.invoice || null;
          stripePaymentIntentId = src.payment_intent || null;
        }
        // Look up local account by customer id (one lookup per unique customer).
        let accountId: string | null = null;
        if (stripeCustomerId) {
          if (customerLookups.has(stripeCustomerId)) {
            accountId = customerLookups.get(stripeCustomerId) || null;
          } else {
            const { data: acct } = await admin
              .from("accounts").select("id").eq("stripe_customer_id", stripeCustomerId).maybeSingle();
            accountId = acct?.id || null;
            customerLookups.set(stripeCustomerId, accountId || "");
          }
        }
        if (!accountId) unmatched++;
        const isZeroDecimal = ["jpy","krw","vnd","clp","pyg","ugx","xaf","xof","kmf","djf","gnf","rwf","mga","bif"].includes(
          (t.currency || "").toLowerCase()
        );
        const div = isZeroDecimal ? 1 : 100;
        const { error } = await admin.from("transactions").upsert({
          stripe_balance_transaction_id: t.id,
          stripe_payment_intent_id: stripePaymentIntentId,
          stripe_invoice_id: stripeInvoiceId,
          stripe_customer_id: stripeCustomerId,
          account_id: accountId,
          date: toISO(t.created),
          description: t.description || t.type || null,
          type: t.type || null,
          amount: (t.amount || 0) / div,
          stripe_fee: (t.fee || 0) / div,
          net_amount: (t.net || 0) / div,
          status: t.status || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_balance_transaction_id" });
        if (!error) n++;
      }
      results.transactions = { synced: n, unmatched_to_account: unmatched, fetched: txns.length };
    }

    return json({ success: true, results });
  } catch (err) {
    console.error("[sync-stripe-data]", err);
    return json({ success: false, error: err instanceof Error ? err.message : "Sync failed" }, 500);
  }
});
