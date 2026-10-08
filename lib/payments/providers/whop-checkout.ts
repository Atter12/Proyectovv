export const WHOP_CHECKOUT_TIMEOUT_MS = 20_000;

export const WHOP_WALLET_PRODUCT_EXTERNAL_ID = "adsholistic-wallet-topup";

/** Whop valida título de plan dinámico a máximo 30 caracteres. */
export const WHOP_PLAN_TITLE_MAX = 30;

export const WHOP_DEFAULT_PLAN_TITLE = "Recarga Holistic";

export function truncateWhopPlanTitle(value: string | undefined): string {
  const trimmed = value?.trim() || WHOP_DEFAULT_PLAN_TITLE;
  if (trimmed.length <= WHOP_PLAN_TITLE_MAX) return trimmed;
  return trimmed.slice(0, WHOP_PLAN_TITLE_MAX).trimEnd();
}

export type WhopCheckoutCreateInput = {
  companyId: string;
  amountCents: number;
  currency: string;
  paymentIntentId: string;
  organizationId: string;
  walletId: string;
  redirectUrl: string;
  productId?: string;
  concept?: string;
  customerEmail?: string;
};

export function buildWhopCheckoutBody(input: WhopCheckoutCreateInput): Record<string, unknown> {
  // Whop es solo para dólares: soles van por Yape/Plin/BCP.
  const currency = "usd";
  const initialPrice = Math.round(input.amountCents) / 100;
  // Concepto largo (cliente Hecom) va a metadata/notas; el título del plan ≤ 30.
  const title = truncateWhopPlanTitle(WHOP_DEFAULT_PLAN_TITLE);
  const notes = input.concept?.trim();

  const plan: Record<string, unknown> = {
    company_id: input.companyId,
    currency,
    initial_price: initialPrice,
    plan_type: "one_time",
    // Sin conversión a moneda local: el cliente paga en USD y el webhook
    // llega en USD, igual que el intent.
    adaptive_pricing_enabled: false,
    title,
    visibility: "hidden",
    ...(notes && notes !== title ? { internal_notes: notes.slice(0, 200) } : {}),
  };

  if (input.productId) {
    plan.product_id = input.productId;
  } else {
    plan.product = {
      external_identifier: WHOP_WALLET_PRODUCT_EXTERNAL_ID,
      title: WHOP_DEFAULT_PLAN_TITLE,
      description: "Saldo de cartera Ads Holistic",
      visibility: "hidden",
    };
  }

  return {
    mode: "payment",
    plan,
    redirect_url: input.redirectUrl,
    metadata: {
      payment_intent_id: input.paymentIntentId,
      organization_id: input.organizationId,
      wallet_id: input.walletId,
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    },
  };
}

export function absoluteWhopPurchaseUrl(purchaseUrl: string): string {
  const trimmed = purchaseUrl.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `https://whop.com${path}`;
}

export function parseWhopCheckoutResponse(data: unknown): {
  id: string;
  purchaseUrl: string;
} | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const purchaseUrl =
    typeof row.purchase_url === "string" ? row.purchase_url.trim() : "";
  if (!id || !purchaseUrl) return null;
  return { id, purchaseUrl: absoluteWhopPurchaseUrl(purchaseUrl) };
}
