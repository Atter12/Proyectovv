import "server-only";
import { serverEnv } from "@/lib/env/env.server";

type StripeErrorBody = { error?: { message?: string } };

async function stripeRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: URLSearchParams,
  idempotencyKey?: string,
): Promise<T> {
  const secret = serverEnv.stripeSecretKey?.trim();
  if (!secret) {
    throw new Error("Stripe no configurado.");
  }

  const url = `https://api.stripe.com/v1${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    Accept: "application/json",
  };
  if (method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? body?.toString() : undefined,
    cache: "no-store",
  });

  const json = (await response.json()) as T & StripeErrorBody;
  if (!response.ok) {
    throw new Error(json.error?.message ?? `Stripe HTTP ${response.status}`);
  }
  return json;
}

export type StripePaymentMethodSummary = {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

export async function createStripeCustomer(input: {
  email: string;
  organizationId: string;
}): Promise<string> {
  const params = new URLSearchParams();
  params.set("email", input.email);
  params.set("metadata[organization_id]", input.organizationId);
  const data = await stripeRequest<{ id: string }>("POST", "/customers", params);
  return data.id;
}

export async function createStripeSetupCheckoutSession(input: {
  stripeCustomerId: string;
  organizationId: string;
  customerEmail: string;
}): Promise<{ sessionId: string; url: string }> {
  const params = new URLSearchParams();
  params.set("mode", "setup");
  params.set("customer", input.stripeCustomerId);
  params.set(
    "success_url",
    `${serverEnv.appUrl}/payments?billing_setup=success&session_id={CHECKOUT_SESSION_ID}`,
  );
  params.set(
    "cancel_url",
    `${serverEnv.appUrl}/payments?billing_setup=cancelled`,
  );
  params.set("metadata[organization_id]", input.organizationId);
  params.set("metadata[purpose]", "auto_recharge");
  if (input.customerEmail && !input.stripeCustomerId) {
    params.set("customer_email", input.customerEmail);
  }

  const data = await stripeRequest<{ id: string; url: string | null }>(
    "POST",
    "/checkout/sessions",
    params,
  );
  if (!data.url) {
    throw new Error("Stripe no devolvió URL de checkout.");
  }
  return { sessionId: data.id, url: data.url };
}

function parsePaymentMethod(
  pm: Record<string, unknown> | null | undefined,
): StripePaymentMethodSummary | null {
  if (!pm || typeof pm !== "object") return null;
  const card = pm.card as Record<string, unknown> | undefined;
  return {
    id: String(pm.id ?? ""),
    brand: card?.brand ? String(card.brand) : null,
    last4: card?.last4 ? String(card.last4) : null,
    expMonth: card?.exp_month != null ? Number(card.exp_month) : null,
    expYear: card?.exp_year != null ? Number(card.exp_year) : null,
  };
}

export async function completeStripeSetupSession(
  sessionId: string,
): Promise<{
  organizationId: string;
  stripeCustomerId: string;
  paymentMethod: StripePaymentMethodSummary;
}> {
  const session = await stripeRequest<{
    id: string;
    mode?: string;
    customer?: string | { id?: string };
    setup_intent?: string | { id?: string; payment_method?: string | Record<string, unknown> };
    metadata?: { organization_id?: string };
  }>(
    "GET",
    `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=setup_intent&expand[]=setup_intent.payment_method`,
  );

  const organizationId = session.metadata?.organization_id?.trim();
  if (!organizationId) {
    throw new Error("Sesión de Stripe sin organization_id.");
  }

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : String(session.customer?.id ?? "");
  if (!stripeCustomerId) {
    throw new Error("Sesión de Stripe sin customer.");
  }

  const setupIntent =
    typeof session.setup_intent === "object" ? session.setup_intent : null;
  const pmRaw = setupIntent?.payment_method;
  const paymentMethod = parsePaymentMethod(
    typeof pmRaw === "object" ? pmRaw : null,
  );
  if (!paymentMethod?.id) {
    throw new Error("No se encontró método de pago en la sesión.");
  }

  const attachParams = new URLSearchParams();
  attachParams.set("customer", stripeCustomerId);
  await stripeRequest(
    "POST",
    `/payment_methods/${encodeURIComponent(paymentMethod.id)}/attach`,
    attachParams,
  );

  const customerParams = new URLSearchParams();
  customerParams.set(
    "invoice_settings[default_payment_method]",
    paymentMethod.id,
  );
  await stripeRequest(
    "POST",
    `/customers/${encodeURIComponent(stripeCustomerId)}`,
    customerParams,
  );

  return { organizationId, stripeCustomerId, paymentMethod };
}

export async function chargeStripeOffSession(input: {
  stripeCustomerId: string;
  paymentMethodId: string;
  amountCents: number;
  currency: string;
  paymentIntentId: string;
  organizationId: string;
  walletId: string;
  idempotencyKey: string;
}): Promise<{ stripePaymentIntentId: string; status: string }> {
  const params = new URLSearchParams();
  params.set("amount", String(input.amountCents));
  params.set("currency", input.currency.toLowerCase());
  params.set("customer", input.stripeCustomerId);
  params.set("payment_method", input.paymentMethodId);
  params.set("off_session", "true");
  params.set("confirm", "true");
  params.set("metadata[payment_intent_id]", input.paymentIntentId);
  params.set("metadata[organization_id]", input.organizationId);
  params.set("metadata[wallet_id]", input.walletId);
  params.set("metadata[source]", "auto_recharge_calendar");

  const data = await stripeRequest<{ id: string; status: string }>(
    "POST",
    "/payment_intents",
    params,
    input.idempotencyKey,
  );

  return { stripePaymentIntentId: data.id, status: data.status };
}
