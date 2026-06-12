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

// Stripe zero-decimal currencies: amounts are already in major units. Must
// match the set in stripe-webhook — without it, e.g. a JPY invoice synced
// here lands as 1/100th of its real value.
const ZERO_DECIMAL = new Set([
  "jpy","krw","vnd","clp","pyg","ugx","xaf","xof","kmf","djf","gnf","rwf","mga","bif",
]);
const minorToMajor = (amount: number | null | undefined, currency: string | null | undefined) => {
  const cur = (currency || "").toLowerCase();
  const div = ZERO_DECIMAL.has(cur) ? 1 : 100;
  return (Number(amount) || 0) / div;
};

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
  // Sync is a destructive write (rebuilds invoices/transactions/subs) and
  // must be admin-only — matches toggl-sync/index.ts. Earlier allowing
  // 'team' let any teammate kick off a full resync from the UI.
  if (!profile || profile.role !== "admin") {
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
        // maybeSingle() errors out (silently here) when multiple contacts share
        // an email — that case used to leave the customer unlinked entirely.
        // Take the first match; prefer one already linked to an account.
        const { data: matches } = await admin
          .from("contacts")
          .select("id, account_id")
          .ilike("email", c.email)
          .order("account_id", { ascending: false, nullsFirst: false })
          .limit(1);
        const contact = matches?.[0];
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
        // Stripe API ≥2024-09-30 moved current_period_* off the subscription
        // root and onto the line item. Read item first, fall back to root.
        const periodStart = item?.current_period_start ?? s.current_period_start;
        const periodEnd = item?.current_period_end ?? s.current_period_end;
        const { data: acct } = await admin
          .from("accounts").select("id").eq("stripe_customer_id", s.customer).maybeSingle();
        // Preserve a previously-stored metadata.account_id when the current
        // customer→account lookup misses. Without this, a full sync after
        // an account is unlinked silently wipes linkage that the webhook
        // (stripe-webhook/index.ts:188-195) takes care to keep.
        const { data: priorSub } = await admin
          .from("stripe_subscriptions").select("metadata").eq("stripe_subscription_id", s.id).maybeSingle();
        const priorMeta = (priorSub?.metadata && typeof priorSub.metadata === "object")
          ? priorSub.metadata as Record<string, unknown>
          : {};
        const nextMeta = acct?.id
          ? { ...priorMeta, ...(s.metadata || {}), account_id: acct.id }
          : { ...priorMeta, ...(s.metadata || {}) };
        const { error } = await admin.from("stripe_subscriptions").upsert({
          stripe_subscription_id: s.id,
          stripe_customer_id: s.customer,
          stripe_product_id: price?.product || null,
          status: s.status,
          current_period_start: toISO(periodStart),
          current_period_end: toISO(periodEnd),
          cancel_at: toISO(s.cancel_at),
          canceled_at: toISO(s.canceled_at),
          amount: price?.unit_amount != null
            ? minorToMajor(price.unit_amount, price.currency)
            : null,
          currency: price?.currency || null,
          interval: price?.recurring?.interval || null,
          metadata: nextMeta,
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
      // Cache stripe_customer_id → local account id lookups across the loop.
      // Without this, a backfill of N invoices for M customers makes N round
      // trips instead of M; transactions below uses the same shape.
      const invoiceCustomerLookups = new Map<string, string | null>();
      for (const inv of invoices) {
        let acctId: string | null = null;
        const custId = inv.customer as string | null | undefined;
        if (custId) {
          if (invoiceCustomerLookups.has(custId)) {
            acctId = invoiceCustomerLookups.get(custId) ?? null;
          } else {
            const { data: acct } = await admin
              .from("accounts").select("id").eq("stripe_customer_id", custId).maybeSingle();
            acctId = acct?.id || null;
            invoiceCustomerLookups.set(custId, acctId);
          }
        }
        // Preserve a previously-stored account_id when the current lookup
        // misses. Without this, a customer transiently unlinked (or a contact
        // deleted) would silently wipe invoice → account linkage on every
        // resync. Matches the stripe-webhook handler's preservation logic.
        if (!acctId) {
          const { data: priorInv } = await admin
            .from("invoices").select("account_id").eq("stripe_invoice_id", inv.id).maybeSingle();
          acctId = priorInv?.account_id ?? null;
          if (!acctId) unmatched++;
        }
        const { error } = await admin.from("invoices").upsert({
          stripe_invoice_id: inv.id,
          account_id: acctId,
          invoice_number: inv.number || null,
          issue_date: toISODate(inv.created),
          due_date: toISODate(inv.due_date),
          status: mapInvoiceStatus(inv),
          subtotal: minorToMajor(inv.subtotal, inv.currency),
          tax: minorToMajor(inv.tax, inv.currency),
          total: minorToMajor(inv.total, inv.currency),
          stripe_invoice_url: inv.hosted_invoice_url || null,
          line_items: (inv.lines?.data || []).map((li: any) => ({
            description: li.description,
            amount: minorToMajor(li.amount, li.currency || inv.currency),
            quantity: li.quantity,
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
      // without an N+1 round trip per transaction. Use the same
      // `string | null` shape as `invoiceCustomerLookups` above — storing
      // `""` as a "miss" sentinel is fragile (`!= null` would treat it as
      // a valid id) and would leave invalid empty-string account ids in
      // transactions if anyone ever changed the read-side guard.
      const customerLookups = new Map<string, string | null>();
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
            accountId = customerLookups.get(stripeCustomerId) ?? null;
          } else {
            const { data: acct } = await admin
              .from("accounts").select("id").eq("stripe_customer_id", stripeCustomerId).maybeSingle();
            accountId = acct?.id || null;
            customerLookups.set(stripeCustomerId, accountId);
          }
        }
        // Preserve a previously-stored account_id on the row — mirrors the
        // invoices block above and the stripe-webhook handler. Without it,
        // a sync that runs while a customer is transiently unlinked nukes
        // every linked transaction's account_id to null.
        if (!accountId) {
          const { data: priorTx } = await admin
            .from("transactions").select("account_id").eq("stripe_balance_transaction_id", t.id).maybeSingle();
          accountId = priorTx?.account_id ?? null;
          if (!accountId) unmatched++;
        }
        const { error } = await admin.from("transactions").upsert({
          stripe_balance_transaction_id: t.id,
          stripe_payment_intent_id: stripePaymentIntentId,
          stripe_invoice_id: stripeInvoiceId,
          stripe_customer_id: stripeCustomerId,
          account_id: accountId,
          date: toISO(t.created),
          description: t.description || t.type || null,
          type: t.type || null,
          amount: minorToMajor(t.amount, t.currency),
          stripe_fee: minorToMajor(t.fee, t.currency),
          net_amount: minorToMajor(t.net, t.currency),
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
