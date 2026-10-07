export const WHOP_CHECKOUT_TIMEOUT_MS = 20_000;

export const WHOP_WALLET_PRODUCT_EXTERNAL_ID = "adsholistic-wallet-topup";

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
  const currency = input.currency.trim().toLowerCase() || "usd";
  const initialPrice = Math.round(input.amountCents) / 100;
  const title =
    input.concept?.trim() || "Recarga Ads Holistic";

  const plan: Record<string, unknown> = {
    company_id: input.companyId,
    currency,
    initial_price: initialPrice,
    plan_type: "one_time",
    title,
    visibility: "hidden",
  };

  if (input.productId) {
    plan.product_id = input.productId;
  } else {
    plan.product = {
      external_identifier: WHOP_WALLET_PRODUCT_EXTERNAL_ID,
      title: "Recarga Ads Holistic",
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
