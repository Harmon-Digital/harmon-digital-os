import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Verify Stripe's `Stripe-Signature` header against the raw request body.
// Header form: t=<unix>,v1=<hex hmac>[,v1=<hex>...]
async function verifyStripeSignature(rawBody: string, sigHeader: string, secret: string) {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => kv.split("=").map((s) => s.trim())),
  ) as Record<string, string>;
  const timestamp = parts["t"];
  if (!timestamp) return false;

  // Replay guard: reject signatures older than 5 minutes OR in the future.
  // `Math.abs` would accept attacker-supplied future timestamps; Stripe only
  // sends timestamps in the past, so a small forward grace (60s clock skew)
  // is the cap.
  const now = Date.now() / 1000;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || now - ts > 300 || ts - now > 60) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload)),
  );
  const expected = Array.from(sigBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  // Stripe may send multiple v1 signatures (key rotation); match any.
  const provided = sigHeader
    .split(",")
    .filter((kv) => kv.trim().startsWith("v1="))
    .map((kv) => kv.split("=")[1].trim());

  return provided.some((sig) => sig.length === expected.length && timingSafeEqual(sig, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const toISODate = (unix?: number | null) =>
  unix ? new Date(unix * 1000).toISOString().slice(0, 10) : null;
const toISO = (unix?: number | null) =>
  unix ? new Date(unix * 1000).toISOString() : null;

function mapInvoiceStatus(inv: any): string {
  switch (inv.status) {
    case "paid": return "paid";
    case "void": return "void";
    case "uncollectible": return "overdue";
    case "open": {
      const due = inv.due_date ? new Date(inv.due_date * 1000) : null;
      return due && due.getTime() < Date.now() ? "overdue" : "sent";
    }
    default: return "draft";
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Server not configured", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  if (!sig || !(await verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET))) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotency: Stripe retries on 5xx/timeout with the same event.id. Stop
  // reprocessing by inserting first; if the row already exists, return early.
  if (event.id) {
    const { error: idemErr } = await admin
      .from("stripe_webhook_events")
      .insert({ event_id: event.id, type: event.type || "unknown" });
    if (idemErr) {
      // Duplicate primary key → already processed. Treat any other error as
      // best-effort: log and continue rather than refuse the webhook.
      if ((idemErr as { code?: string }).code === "23505") {
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      console.warn("[stripe-webhook] idempotency insert failed:", idemErr);
    }
  }

  try {
    const obj = event.data?.object;
    switch (event.type) {
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.finalized":
      case "invoice.voided":
      case "invoice.marked_uncollectible":
      case "invoice.updated": {
        const { data: acct } = await admin
          .from("accounts").select("id").eq("stripe_customer_id", obj.customer).maybeSingle();
        // Look up the prior row's status AND account_id. Status guards against
        // an older event regressing a terminal status (e.g. invoice.updated
        // arriving after invoice.paid). account_id is preserved when the
        // current accounts lookup misses — sync-stripe-data may have linked
        // the account previously, and we must not wipe it back to NULL on a
        // later invoice event.
        const { data: prior } = await admin
          .from("invoices").select("status, account_id").eq("stripe_invoice_id", obj.id).maybeSingle();
        const nextStatus = mapInvoiceStatus(obj);
        const TERMINAL = new Set(["paid", "void"]);
        const finalStatus = prior?.status && TERMINAL.has(prior.status) && !TERMINAL.has(nextStatus)
          ? prior.status
          : nextStatus;
        const finalAccountId = acct?.id ?? prior?.account_id ?? null;
        await admin.from("invoices").upsert({
          stripe_invoice_id: obj.id,
          account_id: finalAccountId,
          invoice_number: obj.number || null,
          issue_date: toISODate(obj.created),
          due_date: toISODate(obj.due_date),
          status: finalStatus,
          subtotal: (obj.subtotal || 0) / 100,
          tax: (obj.tax || 0) / 100,
          total: (obj.total || 0) / 100,
          stripe_invoice_url: obj.hosted_invoice_url || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_invoice_id" });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.created": {
        const price = obj.items?.data?.[0]?.price;
        // Look up the local account so the subscription row stays linked to
        // the customer. Without this, sync-stripe-data's metadata.account_id
        // is the only linkage and a webhook-first subscription is orphaned.
        const { data: subAcct } = await admin
          .from("accounts").select("id").eq("stripe_customer_id", obj.customer).maybeSingle();
        const { data: priorSub } = await admin
          .from("stripe_subscriptions").select("metadata").eq("stripe_subscription_id", obj.id).maybeSingle();
        const priorMeta = (priorSub?.metadata && typeof priorSub.metadata === "object")
          ? priorSub.metadata as Record<string, unknown>
          : {};
        const nextMeta = subAcct?.id
          ? { ...priorMeta, account_id: subAcct.id }
          : priorMeta;
        await admin.from("stripe_subscriptions").upsert({
          stripe_subscription_id: obj.id,
          stripe_customer_id: obj.customer,
          stripe_product_id: price?.product || null,
          status: obj.status,
          current_period_start: toISO(obj.current_period_start),
          current_period_end: toISO(obj.current_period_end),
          cancel_at: toISO(obj.cancel_at),
          canceled_at: toISO(obj.canceled_at),
          amount: price?.unit_amount != null ? price.unit_amount / 100 : null,
          currency: price?.currency || null,
          interval: price?.recurring?.interval || null,
          metadata: nextMeta,
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_subscription_id" });
        break;
      }
      default:
        // Acknowledge unhandled events so Stripe doesn't retry.
        break;
    }
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    return new Response("Handler error", { status: 500 });
  }
});
