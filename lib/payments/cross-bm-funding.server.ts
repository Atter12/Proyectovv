import { serverEnv } from "@/lib/env/env.server";
import {
  HECOM_BM_BUCKET_TO_BC,
  resolveBmBucketFromBcId,
} from "@/lib/hecom/bm-bucket.shared";
import {
  getAdvertiserBudgetSnapshot,
  getBcPortfolioHint,
  resolveTikTokFinanceAccessToken,
} from "@/lib/integrations/tiktok/bc-finance.server";
import { listPaymentPortfoliosForBc } from "@/lib/integrations/tiktok/payment-portfolio.server";

interface TikTokApiResponse<T> {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
}

export interface AgencyBmFundingRow {
  bmBucket: string;
  bcId: string;
  shared: boolean;
  cashUsd: number;
  grantUsd: number;
  creditLineUsd: number;
  portfolios: Array<{
    id: string;
    name: string | null;
    availableCredit: number | null;
  }>;
}

export interface CrossBmFundingPlan {
  targetBcId: string;
  targetBmBucket: string | null;
  amountUsd: number;
  canFundOnTarget: boolean;
  blockReason: string | null;
  recommendations: string[];
  agencyLandscape: AgencyBmFundingRow[];
  multiTierBcEnabled: boolean;
}

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Panorama de cash/crédito en los BM de agencia Holistic (10 / 30 / 200). */
export async function getAgencyBmFundingLandscape(
  organizationId?: string,
): Promise<AgencyBmFundingRow[]> {
  const rows: AgencyBmFundingRow[] = [];

  for (const [bmBucket, bcId] of Object.entries(HECOM_BM_BUCKET_TO_BC)) {
    const hint = await getBcPortfolioHint({ bcId, organizationId });
    const portfolios = await listPaymentPortfoliosForBc({ bcId, organizationId });
    const portfolioId = portfolios[0]?.paymentPortfolioId ?? null;

    const { token } = await resolveTikTokFinanceAccessToken(organizationId);
    const url = new URL(apiUrl("/bc/balance/get/"));
    url.searchParams.set("bc_id", bcId);
    if (portfolioId) {
      url.searchParams.set("payment_portfolio_id", portfolioId);
    }
    const response = await fetch(url.toString(), {
      headers: { "Access-Token": token },
      cache: "no-store",
    });
    const json = (await response.json()) as TikTokApiResponse<{
      valid_cash_balance?: number;
      cash_balance?: number;
      valid_grant_balance?: number;
      grant_balance?: number;
      valid_account_balance?: number;
      account_balance?: number;
    }>;

    const num = (v: number | undefined): number =>
      Number.isFinite(Number(v)) ? Number(v) : 0;

    const data = json.data ?? {};
    rows.push({
      bmBucket,
      bcId,
      shared: hint?.shared ?? bmBucket !== "200",
      cashUsd: num(data.valid_cash_balance ?? data.cash_balance),
      grantUsd: num(data.valid_grant_balance ?? data.grant_balance),
      creditLineUsd: num(data.valid_account_balance ?? data.account_balance),
      portfolios: portfolios.map((p) => ({
        id: p.paymentPortfolioId,
        name: p.name,
        availableCredit: p.availableCredit,
      })),
    });
  }

  return rows;
}

export interface SharedBmSpendability {
  bcId: string;
  advertiserId: string;
  budget: number;
  budgetCost: number;
  budgetHeadroomUsd: number;
  accountBalanceUsd: number;
  transferableUsd: number;
  paymentPortfolioId: string | null;
  shared: boolean;
}

export async function getSharedBmSpendability(input: {
  bcId: string;
  advertiserId: string;
  organizationId?: string;
}): Promise<SharedBmSpendability | null> {
  const snapshot = await getAdvertiserBudgetSnapshot(input);
  if (!snapshot) return null;

  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);
  const url = new URL(apiUrl("/advertiser/balance/get/"));
  url.searchParams.set("bc_id", input.bcId.trim());
  url.searchParams.set(
    "filtering",
    JSON.stringify({ keyword: input.advertiserId.trim() }),
  );
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "20");

  const response = await fetch(url.toString(), {
    headers: { "Access-Token": token },
    cache: "no-store",
  });
  const json = (await response.json()) as TikTokApiResponse<{
    advertiser_account_list?: Array<{
      transferable_amount?: number | string;
      payment_portfolio_id?: string | number;
    }>;
  }>;

  const row = (json.data?.advertiser_account_list ?? [])[0];
  const transferable = Number(row?.transferable_amount ?? 0);
  const portfolioId = row?.payment_portfolio_id
    ? String(row.payment_portfolio_id)
    : null;

  const budgetHeadroom = Math.max(0, snapshot.budget - snapshot.budgetCost);
  const accountBalance = snapshot.accountBalance ?? 0;

  return {
    bcId: input.bcId,
    advertiserId: input.advertiserId,
    budget: snapshot.budget,
    budgetCost: snapshot.budgetCost,
    budgetHeadroomUsd: Math.round(budgetHeadroom * 100) / 100,
    accountBalanceUsd: accountBalance,
    transferableUsd: Number.isFinite(transferable) ? transferable : 0,
    paymentPortfolioId: portfolioId,
    shared: snapshot.paymentPortfolioType === "SHARED",
  };
}

export function formatSharedBmNoCreditError(input: {
  bmBucket: string | null;
  spendability: SharedBmSpendability;
  amountUsd: number;
}): string {
  const { spendability, amountUsd, bmBucket } = input;
  const bm = bmBucket ? `BM ${bmBucket}` : "este BM";

  if (amountUsd <= spendability.budgetHeadroomUsd + 1e-9) {
    return "";
  }

  return (
    `El portfolio de crédito en ${bm} no tiene cupo disponible para sumar $${amountUsd.toFixed(2)} más ` +
    `(crédito en cuenta: $${spendability.accountBalanceUsd.toFixed(2)}, ` +
    `cupo sin gastar del presupuesto: $${spendability.budgetHeadroomUsd.toFixed(2)}). ` +
    "Subir presupuesto vía API no crea saldo gastable si el portfolio está en $0. " +
    "Opciones: (1) Pedir a TikTok/soporte recargar crédito del Payment Portfolio, " +
    "(2) Solicitar allowlist Multi-tier BC para mover crédito entre BM de la agencia, " +
    "(3) Usar una cuenta en BM 200 (cash) o BM 30 con crédito activo."
  );
}

/** Valida que un allocate en BM SHARED no deje saldo no gastable. */
export async function assertSharedBmSpendableBeforeAllocate(input: {
  bcId: string;
  advertiserId: string;
  amountUsd: number;
  organizationId?: string;
}): Promise<SharedBmSpendability> {
  const spendability = await getSharedBmSpendability(input);
  if (!spendability) {
    throw new Error(
      "No se pudo leer el crédito/presupuesto de esa cuenta en TikTok.",
    );
  }

  if (!spendability.shared) return spendability;

  const bmBucket = resolveBmBucketFromBcId(input.bcId);
  const message = formatSharedBmNoCreditError({
    bmBucket,
    spendability,
    amountUsd: input.amountUsd,
  });
  if (message) throw new Error(message);

  return spendability;
}

/**
 * Intenta mover crédito entre BCs hijos (BM30 → BM10).
 * Requiere allowlist Multi-tier BC en TikTok (error 40000 si no está habilitado).
 */
export async function attemptCrossBmCreditPull(input: {
  sourceBcId: string;
  targetBcId: string;
  amountUsd: number;
  organizationId?: string;
  requestId?: string;
}): Promise<{ ok: true; tiktokRequestId: string | null }> {
  if (!serverEnv.tiktokMultiTierBcEnabled) {
    throw new Error(
      "Cross-BM no está habilitado en Holistic (TIKTOK_MULTI_TIER_BC_ENABLED). " +
        "Pedile a TikTok el allowlist Multi-tier BC y activá el flag en Vercel.",
    );
  }

  const amount = Math.round(input.amountUsd * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Monto cross-BM inválido.");
  }

  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);
  const requestId =
    input.requestId ??
    String(Date.now()).padEnd(32, "0").slice(0, 32);

  const body = {
    bc_id: input.sourceBcId.trim(),
    child_bc_id: input.targetBcId.trim(),
    transfer_level: "BC",
    transfer_type: "RECHARGE",
    cash_amount: amount,
    request_id: requestId,
  };

  console.info("[cross-bm] credit_pull_attempt", body);

  const response = await fetch(apiUrl("/bc/transfer/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": token,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await response.json()) as TikTokApiResponse<Record<string, unknown>>;

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    const detail = json.message ?? `HTTP ${response.status}`;
    console.warn("[cross-bm] credit_pull_failed", {
      code: json.code ?? null,
      message: detail,
      sourceBcId: input.sourceBcId,
      targetBcId: input.targetBcId,
    });

    if (json.code === 40000 || /allowlist|multi-tier/i.test(detail)) {
      throw new Error(
        "TikTok bloqueó la transferencia cross-BM (Multi-tier BC es allowlist-only). " +
          "Contactá a tu representante TikTok para habilitar BM padre→hijo.",
      );
    }

    throw new Error(`No se pudo mover crédito entre BM: ${detail}`);
  }

  console.info("[cross-bm] credit_pull_ok", {
    sourceBcId: input.sourceBcId,
    targetBcId: input.targetBcId,
    amount,
    tiktokRequestId: json.request_id ?? null,
  });

  return { ok: true, tiktokRequestId: json.request_id ?? null };
}

/** Plan de fondeo cross-BM para gerente (diagnóstico, no muta TikTok). */
export async function buildCrossBmFundingPlan(input: {
  targetBcId: string;
  advertiserId: string;
  amountUsd: number;
  organizationId?: string;
}): Promise<CrossBmFundingPlan> {
  const landscape = await getAgencyBmFundingLandscape(input.organizationId);
  const targetBmBucket = resolveBmBucketFromBcId(input.targetBcId);
  const spendability = await getSharedBmSpendability({
    bcId: input.targetBcId,
    advertiserId: input.advertiserId,
    organizationId: input.organizationId,
  });

  const recommendations: string[] = [];
  let canFundOnTarget = true;
  let blockReason: string | null = null;

  if (spendability?.shared) {
    const err = formatSharedBmNoCreditError({
      bmBucket: targetBmBucket,
      spendability,
      amountUsd: input.amountUsd,
    });
    if (err) {
      canFundOnTarget = false;
      blockReason = err;
    }
  }

  const bm30 = landscape.find((r) => r.bmBucket === "30");
  const bm10 = landscape.find((r) => r.bmBucket === "10");
  const bm200 = landscape.find((r) => r.bmBucket === "200");

  if (targetBmBucket === "10" && bm30 && bm30.creditLineUsd > 0) {
    recommendations.push(
      `BM 30 tiene ~$${bm30.creditLineUsd.toFixed(0)} de línea de crédito, pero BM 10 (PANAMERICANA) es otro cliente legal en TikTok. ` +
        "Sin allowlist Multi-tier BC no se puede jalar ese crédito por API.",
    );
  }

  if (bm200 && bm200.cashUsd >= input.amountUsd) {
    recommendations.push(
      `BM 200 tiene ~$${bm200.cashUsd.toFixed(0)} cash — funciona solo para cuentas ads creadas en BM 200.`,
    );
  }

  if (bm10 && bm10.creditLineUsd <= 0) {
    recommendations.push(
      "Recargar crédito del Payment Portfolio PANAMERICANA en TikTok Ads Manager (Finance → Payment management).",
    );
  }

  if (!serverEnv.tiktokMultiTierBcEnabled) {
    recommendations.push(
      "Cuando TikTok habilite Multi-tier BC, activar TIKTOK_MULTI_TIER_BC_ENABLED=true en Vercel.",
    );
  }

  return {
    targetBcId: input.targetBcId,
    targetBmBucket,
    amountUsd: input.amountUsd,
    canFundOnTarget,
    blockReason,
    recommendations,
    agencyLandscape: landscape,
    multiTierBcEnabled: serverEnv.tiktokMultiTierBcEnabled,
  };
}
