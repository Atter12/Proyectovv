import { serverEnv } from "@/lib/env/env.server";
import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";
import { getTikTokConnection } from "@/lib/integrations/tiktok/client.server";

interface TikTokApiResponse<T> {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
}

/** TikTok API usa RECHARGE | REFUND (REFUND = sacar cash/crédito del advertiser). */
export type TikTokBcTransferType = "RECHARGE" | "REFUND";

/** Fuente de fondos en `/bc/transfer/` — no incluye línea de crédito SHARED. */
export type TikTokBcFundingSource = "cash" | "grant";

export interface TikTokBcTransferInput {
  bcId: string;
  advertiserId: string;
  /** Monto en unidades de moneda (USD), no cents. */
  cashAmount: number;
  requestId: string;
  transferType?: TikTokBcTransferType;
  organizationId?: string;
}

export interface TikTokBcTransferResult {
  ok: true;
  requestId: string;
  tiktokRequestId: string | null;
  fundingSource: TikTokBcFundingSource;
  raw: Record<string, unknown>;
}

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function tokenFingerprint(token: string): string {
  const t = token.trim();
  if (t.length < 12) return `len=${t.length}`;
  return `${t.slice(0, 6)}…${t.slice(-4)} (len=${t.length})`;
}

type TokenSource = "agency_env" | "org_oauth";

/**
 * Token para finance BC (/bc/transfer/):
 * 1) TIKTOK_ACCESS_TOKEN de agencia (env) — rol Finance del BM
 * 2) OAuth de la org (fallback; a menudo NO tiene permiso finance)
 */
export async function resolveTikTokFinanceAccessToken(
  organizationId?: string,
): Promise<{ token: string; source: TokenSource }> {
  const agency = serverEnv.tiktokAccessToken.trim();
  if (agency) return { token: agency, source: "agency_env" };

  if (organizationId) {
    try {
      const connection = await getTikTokConnection(organizationId);
      if (connection?.accessToken) {
        return { token: connection.accessToken, source: "org_oauth" };
      }
    } catch {
      // sin conexión org
    }
  }

  throw new Error(
    "Sin token TikTok para recargar BM. Configurá TIKTOK_ACCESS_TOKEN (usuario con finance_role en el BM) o conectá TikTok en la org.",
  );
}

export function isTikTokBcFundingEnabled(): boolean {
  return serverEnv.tiktokBcFundingEnabled;
}

function formatTransferError(input: {
  code: number | null;
  message: string;
  tiktokRequestId: string | null;
  bcId: string;
  advertiserId: string;
  tokenSource: TokenSource;
  tokenFp: string;
}): string {
  // Log técnico completo solo en server; al cliente va mensaje corto.
  console.warn("[tiktok-bc] transfer_error_detail", {
    code: input.code,
    message: input.message,
    bcId: input.bcId,
    advertiserId: input.advertiserId,
    tokenSource: input.tokenSource,
    tokenFp: input.tokenFp,
    tiktokRequestId: input.tiktokRequestId,
  });

  if (
    /amountToTransfer is less than transferableAmount|min_transferable|minimum.*transfer/i.test(
      input.message,
    )
  ) {
    return "Ese monto es menor al mínimo que TikTok permite en esta cuenta. Probá con $10 o más.";
  }

  if (
    /finance permission|insufficient permission|no permission/i.test(input.message) ||
    (input.code === 40001 && /permission/i.test(input.message)) ||
    (input.code === 40002 && /permission/i.test(input.message))
  ) {
    return "No hay permiso Finance en este Business Center para recargar. Pedile a soporte que revise el BM.";
  }

  if (/abnormal state|cannot be used for top-up|banned|suspended/i.test(input.message)) {
    return "Esta cuenta ads no puede recibir saldo ahora (puede estar suspendida). Probá con otra cuenta Aprobada.";
  }

  if (
    input.code === 51060 ||
    /coupon balance not enough|grant balance/i.test(input.message)
  ) {
    return "Este BM no tiene ad credits (cupones) disponibles para asignar. Asignar solo mueve efectivo o cupones, no la línea de crédito. Probá BM 200 o pedile a soporte que cargue cash en el BM.";
  }

  if (/Can not find the paInfo|multi pa|specify paId/i.test(input.message)) {
    return "Este BM usa Payment Portfolio (multi-PA). Holistic debe enviar payment_portfolio_id; si ves este error, pedile a soporte que revise el fondeo del BM.";
  }

  if (
    input.code === 40002 ||
    /params invalid|invalid param|cash_amount|insufficient.*(cash|balance|fund)/i.test(
      input.message,
    )
  ) {
    return "No se pudo mover saldo a esa cuenta desde su BM. Suele ser: el BM no tiene cash disponible, o la cuenta no está lista en TikTok. Probá una cuenta de BM 200 o pedile a soporte que cargue cash en ese BM.";
  }

  return "No se pudo asignar el saldo en TikTok ahora. Tu dinero sigue en la cartera Holistic. Probá otra cuenta o contactá soporte.";
}

function formatBlockedTransferError(input: {
  cashAvailable: number;
  grantAvailable: number;
  accountBalance: number | null;
  shared: boolean;
  cashAmount: number;
}): string {
  const { cashAvailable, grantAvailable, accountBalance, shared, cashAmount } =
    input;

  if (cashAvailable + 1e-9 >= cashAmount) {
    throw new Error("Internal: cash check should not block valid transfer.");
  }

  if (grantAvailable + 1e-9 >= cashAmount) {
    throw new Error("Internal: grant check should not block valid transfer.");
  }

  if (shared && cashAvailable <= 0 && grantAvailable <= 0) {
    const creditHint =
      accountBalance != null && accountBalance > 0
        ? ` TikTok muestra ~$${accountBalance.toFixed(0)} de línea de crédito, pero la API no puede moverla: solo efectivo o cupones.`
        : "";
    return (
      "Este BM (crédito compartido) no tiene saldo en efectivo ni cupones." +
      creditHint +
      " Usá una cuenta de BM 200 (tiene efectivo) o pedile a soporte que cargue cash en ese BM."
    );
  }

  if (cashAvailable <= 0 && grantAvailable <= 0) {
    return "Este Business Center no tiene cash ni cupones para asignar. Tu saldo sigue en la cartera Holistic. Probá BM 200 o pedile a soporte que fondee ese BM.";
  }

  const best = Math.max(cashAvailable, grantAvailable);
  return `Este BM solo tiene ~$${best.toFixed(2)} disponible (${cashAvailable > 0 ? "cash" : "cupones"}). Pedí menos o usá otra cuenta/BM. Tu saldo sigue en la cartera Holistic.`;
}

type ResolvedBcFunding =
  | { source: TikTokBcFundingSource; available: number }
  | { source: "blocked"; detail: BcBalanceDetail };

/**
 * BM multi-PA (ej. BM 200): `/bc/balance/get/` y `/bc/transfer/` exigen
 * `payment_portfolio_id` como string exacto (Number() pierde precisión).
 */
async function resolveBcPaymentPortfolioId(input: {
  bcId: string;
  organizationId?: string;
}): Promise<string | null> {
  const { token: accessToken } = await resolveTikTokFinanceAccessToken(
    input.organizationId,
  );
  const url = new URL(apiUrl("/payment_portfolio/get/"));
  url.searchParams.set("bc_id", input.bcId.trim());
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "50");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Access-Token": accessToken },
    cache: "no-store",
  });
  const json = (await response.json()) as TikTokApiResponse<{
    list?: Array<Record<string, unknown>>;
    payment_portfolios?: Array<Record<string, unknown>>;
  }>;

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    console.warn("[tiktok-bc] portfolio_resolve_failed", {
      bcId: input.bcId,
      code: json.code ?? null,
      message: json.message ?? null,
    });
    return null;
  }

  const rows = json.data?.payment_portfolios ?? json.data?.list ?? [];
  const ids = rows
    .map((row) => {
      const raw = row.payment_portfolio_id;
      return typeof raw === "string" ? raw.trim() : raw != null ? String(raw) : "";
    })
    .filter(Boolean);

  if (ids.length === 0) return null;
  if (ids.length === 1) return ids[0];

  const nonShared = rows.find(
    (row) => String(row.payment_portfolio_type ?? "") === "NON_SHARED",
  );
  const preferred = nonShared?.payment_portfolio_id;
  if (typeof preferred === "string" && preferred.trim()) return preferred.trim();
  if (preferred != null) return String(preferred);
  return ids[0];
}

function resolveBcFundingSource(
  detail: BcBalanceDetail,
  amount: number,
): ResolvedBcFunding {
  const cashAvailable =
    detail.validCashBalance ?? detail.cashBalance ?? 0;
  const grantAvailable =
    detail.validGrantBalance ?? detail.grantBalance ?? 0;

  if (cashAvailable + 1e-9 >= amount) {
    return { source: "cash", available: cashAvailable };
  }
  if (grantAvailable + 1e-9 >= amount) {
    return { source: "grant", available: grantAvailable };
  }
  return { source: "blocked", detail };
}

function buildTransferBody(input: {
  bcId: string;
  advertiserId: string;
  transferType: TikTokBcTransferType;
  amount: number;
  fundingSource: TikTokBcFundingSource;
  requestId: string;
  /** Obligatorio en BM multi-PA (ej. BM 200). String exacto, no Number. */
  paymentPortfolioId?: string | null;
}): Record<string, unknown> {
  const amount = Math.round(input.amount * 100) / 100;
  const body: Record<string, unknown> = {
    bc_id: input.bcId,
    advertiser_id: input.advertiserId,
    transfer_type: input.transferType,
    request_id: input.requestId.trim(),
  };
  const portfolioId = input.paymentPortfolioId?.trim();
  if (portfolioId) {
    body.payment_portfolio_id = portfolioId;
  }
  if (input.fundingSource === "grant") {
    body.grant_amount = amount;
  } else {
    body.cash_amount = amount;
  }
  return body;
}

/**
 * Mueve cash del Business Center → advertiser (o al revés con REFUND).
 * @see https://business-api.tiktok.com/portal/docs?id=1739939095321601
 */
export async function transferBcFundsToAdvertiser(
  input: TikTokBcTransferInput,
): Promise<TikTokBcTransferResult> {
  const bcId = input.bcId.trim();
  const advertiserId = input.advertiserId.trim();
  const cashAmount = Number(input.cashAmount);
  const transferType = input.transferType ?? "RECHARGE";

  if (!bcId) throw new Error("Falta bc_id (Business Center).");
  if (!advertiserId) throw new Error("Falta advertiser_id de TikTok.");
  if (!Number.isFinite(cashAmount) || cashAmount <= 0) {
    throw new Error("Monto de transfer TikTok inválido.");
  }
  // Defensa: nunca enviar “centavos disfrazados de dólares” (ej. 12000 en vez de 120).
  if (cashAmount > 50_000) {
    throw new Error(
      "Monto TikTok fuera de rango seguro. Operación cancelada para evitar un descuento incorrecto en el BM.",
    );
  }
  // Solo 2 decimales USD.
  if (Math.round(cashAmount * 100) / 100 !== cashAmount) {
    throw new Error("Monto TikTok inválido (debe ser USD con máximo 2 decimales).");
  }
  if (!input.requestId.trim()) {
    throw new Error("request_id es obligatorio (idempotencia).");
  }

  const { token: accessToken, source: tokenSource } =
    await resolveTikTokFinanceAccessToken(input.organizationId);
  const tokenFp = tokenFingerprint(accessToken);

  // BM multi-PA (BM 200): sin payment_portfolio_id TikTok responde
  // "Can not find the paInfo…" y el balance parece $0.
  const paymentPortfolioId = await resolveBcPaymentPortfolioId({
    bcId,
    organizationId: input.organizationId,
  });

  // REFUND: cash sale del advertiser → BC. No exige cash disponible en el BM.
  let fundingSource: TikTokBcFundingSource = "cash";
  let fundingAvailable: number = Infinity;

  if (transferType !== "REFUND") {
    const balanceDetail = await getBcBalanceDetail({
      bcId,
      organizationId: input.organizationId,
      paymentPortfolioId,
    });
    const funding = balanceDetail
      ? resolveBcFundingSource(balanceDetail, cashAmount)
      : { source: "cash" as const, available: Infinity };

    if (funding.source === "blocked") {
      const d = funding.detail;
      const cashAvailable = d.validCashBalance ?? d.cashBalance ?? 0;
      const grantAvailable = d.validGrantBalance ?? d.grantBalance ?? 0;
      const accountBalance = d.validAccountBalance ?? d.accountBalance;
      const shared = d.paymentPortfolioType === "SHARED";
      console.warn("[tiktok-bc] transfer_blocked_no_funds", {
        bcId,
        advertiserId,
        cashAmount,
        cashAvailable,
        grantAvailable,
        accountBalance,
        shared,
        paymentPortfolioId,
        paymentPortfolioType: d.paymentPortfolioType,
        tokenSource,
        tokenFp,
      });
      throw new Error(
        formatBlockedTransferError({
          cashAvailable,
          grantAvailable,
          accountBalance,
          shared,
          cashAmount,
        }),
      );
    }
    fundingSource = funding.source;
    fundingAvailable = funding.available;
  }

  const body = buildTransferBody({
    bcId,
    advertiserId,
    transferType,
    amount: cashAmount,
    fundingSource,
    requestId: input.requestId,
    paymentPortfolioId,
  });

  console.info("[tiktok-bc] transfer_attempt", {
    bcId,
    advertiserId,
    amount: cashAmount,
    fundingSource,
    fundingAvailable,
    paymentPortfolioId,
    transferType,
    requestId: input.requestId,
    tokenSource,
    tokenFp,
    fundingEnabled: isTikTokBcFundingEnabled(),
    defaultBcIdSet: Boolean(serverEnv.tiktokDefaultBcId.trim()),
  });

  const response = await fetch(apiUrl("/bc/transfer/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": accessToken,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await response.json()) as TikTokApiResponse<Record<string, unknown>> & {
    log_id?: string;
  };

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    const detail = json.message ?? `HTTP ${response.status}`;
    const tiktokRequestId = json.request_id ?? json.log_id ?? null;
    console.error("[tiktok-bc] transfer_failed", {
      httpStatus: response.status,
      code: json.code ?? null,
      message: detail,
      bcId,
      advertiserId,
      cashAmount,
      fundingSource,
      transferBody: body,
      transferType,
      requestId: input.requestId,
      tiktokRequestId,
      tokenSource,
      tokenFp,
      rawKeys: json && typeof json === "object" ? Object.keys(json) : [],
    });
    throw new Error(
      formatTransferError({
        code: json.code ?? null,
        message: detail,
        tiktokRequestId,
        bcId,
        advertiserId,
        tokenSource,
        tokenFp,
      }),
    );
  }

  console.info("[tiktok-bc] transfer_ok", {
    bcId,
    advertiserId,
    cashAmount,
    fundingSource,
    transferType,
    requestId: input.requestId,
    tiktokRequestId: json.request_id ?? null,
    tokenSource,
    tokenFp,
  });

  return {
    ok: true,
    requestId: input.requestId,
    tiktokRequestId: json.request_id ?? null,
    fundingSource,
    raw: (json.data ?? {}) as Record<string, unknown>,
  };
}

export async function getBcCashBalance(input: {
  bcId: string;
  organizationId?: string;
}): Promise<number | null> {
  const detail = await getBcBalanceDetail(input);
  return detail?.validCashBalance ?? detail?.cashBalance ?? null;
}

export async function getBcPortfolioHint(input: {
  bcId: string;
  organizationId?: string;
}): Promise<{ shared: boolean; accountBalance: number | null } | null> {
  const detail = await getBcBalanceDetail(input);
  if (!detail) return null;
  return {
    shared: detail.paymentPortfolioType === "SHARED",
    accountBalance: detail.validAccountBalance ?? detail.accountBalance,
  };
}

type BcBalanceDetail = {
  cashBalance: number | null;
  validCashBalance: number | null;
  grantBalance: number | null;
  validGrantBalance: number | null;
  accountBalance: number | null;
  validAccountBalance: number | null;
  paymentPortfolioType: string | null;
};

async function getBcBalanceDetail(input: {
  bcId: string;
  organizationId?: string;
  paymentPortfolioId?: string | null;
}): Promise<BcBalanceDetail | null> {
  const { token: accessToken, source: tokenSource } =
    await resolveTikTokFinanceAccessToken(input.organizationId);

  const fetchBalance = async (
    paymentPortfolioId: string | null,
  ): Promise<{
    ok: boolean;
    code: number | null;
    message: string | null;
    requestId: string | null;
    data: {
      cash_balance?: number | string;
      valid_cash_balance?: number | string;
      grant_balance?: number | string;
      valid_grant_balance?: number | string;
      account_balance?: number | string;
      valid_account_balance?: number | string;
      balance?: number | string;
      payment_portfolio_type?: string;
    } | null;
  }> => {
    const url = new URL(apiUrl("/bc/balance/get/"));
    url.searchParams.set("bc_id", input.bcId.trim());
    if (paymentPortfolioId) {
      url.searchParams.set("payment_portfolio_id", paymentPortfolioId);
    }
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Access-Token": accessToken },
      cache: "no-store",
    });
    const json = (await response.json()) as TikTokApiResponse<{
      cash_balance?: number | string;
      valid_cash_balance?: number | string;
      grant_balance?: number | string;
      valid_grant_balance?: number | string;
      account_balance?: number | string;
      valid_account_balance?: number | string;
      balance?: number | string;
      payment_portfolio_type?: string;
    }>;
    const ok = response.ok && (json.code === undefined || json.code === 0);
    return {
      ok,
      code: json.code ?? null,
      message: json.message ?? null,
      requestId: json.request_id ?? null,
      data: json.data ?? null,
    };
  };

  let portfolioId = input.paymentPortfolioId?.trim() || null;
  let result = await fetchBalance(portfolioId);

  // Multi-PA: sin portfolio_id TikTok no encuentra paInfo.
  if (
    !result.ok &&
    !portfolioId &&
    /paInfo|multi pa|specify paId/i.test(String(result.message ?? ""))
  ) {
    portfolioId = await resolveBcPaymentPortfolioId({
      bcId: input.bcId,
      organizationId: input.organizationId,
    });
    if (portfolioId) {
      result = await fetchBalance(portfolioId);
    }
  }

  if (!result.ok) {
    console.warn("[tiktok-bc] balance_get_failed", {
      code: result.code,
      message: result.message,
      bcId: input.bcId,
      paymentPortfolioId: portfolioId,
      tokenSource,
      tokenFp: tokenFingerprint(accessToken),
      tiktokRequestId: result.requestId,
    });
    return null;
  }

  const num = (v: number | string | null | undefined): number | null => {
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    cashBalance: num(result.data?.cash_balance ?? result.data?.balance),
    validCashBalance: num(result.data?.valid_cash_balance),
    grantBalance: num(result.data?.grant_balance),
    validGrantBalance: num(result.data?.valid_grant_balance),
    accountBalance: num(result.data?.account_balance),
    validAccountBalance: num(result.data?.valid_account_balance),
    paymentPortfolioType: result.data?.payment_portfolio_type
      ? String(result.data.payment_portfolio_type)
      : null,
  };
}

/** BM SHARED sin cash: la línea de crédito (account_balance) no es asignable vía API. */
export function isSharedCreditOnlyBm(detail: {
  paymentPortfolioType: string | null;
  validCashBalance: number | null;
  cashBalance: number | null;
  validGrantBalance?: number | null;
  grantBalance?: number | null;
}): boolean {
  const cash = detail.validCashBalance ?? detail.cashBalance ?? 0;
  const grant =
    detail.validGrantBalance ?? detail.grantBalance ?? 0;
  return (
    detail.paymentPortfolioType === "SHARED" && cash <= 0 && grant <= 0
  );
}

export interface TikTokAdvertiserBudgetSnapshot {
  budget: number;
  budgetCost: number;
  budgetMode: string;
  accountBalance: number | null;
  cashBalance: number | null;
  validCashBalance: number | null;
  paymentPortfolioType: string | null;
}

export async function getAdvertiserBudgetSnapshot(input: {
  bcId: string;
  advertiserId: string;
  organizationId?: string;
}): Promise<TikTokAdvertiserBudgetSnapshot | null> {
  const { token: accessToken, source: tokenSource } =
    await resolveTikTokFinanceAccessToken(input.organizationId);
  const url = new URL(apiUrl("/advertiser/balance/get/"));
  url.searchParams.set("bc_id", input.bcId.trim());
  url.searchParams.set(
    "filtering",
    JSON.stringify({ keyword: input.advertiserId.trim() }),
  );
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "20");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Access-Token": accessToken },
    cache: "no-store",
  });
  const json = (await response.json()) as TikTokApiResponse<{
    list?: Array<{
      advertiser_id?: string | number;
      advertiserId?: string | number;
      budget?: number | string;
      budget_cost?: number | string;
      budget_mode?: string;
      account_balance?: number | string;
      cash_balance?: number | string;
      valid_cash_balance?: number | string;
      payment_portfolio_type?: string;
    }>;
    advertiser_account_list?: Array<{
      advertiser_id?: string | number;
      advertiserId?: string | number;
      budget?: number | string;
      budget_cost?: number | string;
      budget_mode?: string;
      account_balance?: number | string;
      cash_balance?: number | string;
      valid_cash_balance?: number | string;
      payment_portfolio_type?: string;
    }>;
  }>;

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    console.warn("[tiktok-bc] advertiser_balance_get_failed", {
      code: json.code ?? null,
      message: json.message ?? null,
      bcId: input.bcId,
      advertiserId: input.advertiserId,
      tokenSource,
      tokenFp: tokenFingerprint(accessToken),
    });
    return null;
  }

  const want = input.advertiserId.trim();
  const rows = [
    ...(json.data?.advertiser_account_list ?? []),
    ...(json.data?.list ?? []),
  ];
  const row = rows.find(
    (item) => String(item.advertiser_id ?? item.advertiserId ?? "") === want,
  );
  if (!row) return null;

  const num = (v: number | string | null | undefined): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const numOrNull = (
    v: number | string | null | undefined,
  ): number | null => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    budget: num(row.budget),
    budgetCost: num(row.budget_cost),
    budgetMode: String(row.budget_mode ?? "CUSTOM_BUDGET"),
    accountBalance: numOrNull(row.account_balance),
    cashBalance: numOrNull(row.cash_balance),
    validCashBalance: numOrNull(row.valid_cash_balance),
    paymentPortfolioType: row.payment_portfolio_type
      ? String(row.payment_portfolio_type)
      : null,
  };
}

/**
 * BM SHARED (10/30): no hay cash que transferir. La cuenta gasta de la línea de
 * crédito según su presupuesto (CUSTOM/DAILY/UNLIMITED).
 * Asignar = subir presupuesto vía POST /advertiser/update/.
 *
 * Requiere permiso de app `/advertiser/update/` aprobado en TikTok portal.
 */
async function resolveSharedBudgetSnapshot(input: {
  bcId: string;
  advertiserId: string;
  organizationId?: string;
}): Promise<{
  bcId: string;
  snapshot: TikTokAdvertiserBudgetSnapshot;
}> {
  const primaryBc = input.bcId.trim();
  const advertiserId = input.advertiserId.trim();
  const primary = await getAdvertiserBudgetSnapshot({
    bcId: primaryBc,
    advertiserId,
    organizationId: input.organizationId,
  });
  if (primary) return { bcId: primaryBc, snapshot: primary };

  // Si Holistic tiene mal el BM (ej. label BM10 pero la cuenta vive en BM30),
  // buscamos en los BC de agencia sin mutar nada todavía.
  const candidates = Object.values(HECOM_BM_BUCKET_TO_BC).filter(
    (id) => id && id !== primaryBc,
  );
  for (const altBc of candidates) {
    const snap = await getAdvertiserBudgetSnapshot({
      bcId: altBc,
      advertiserId,
      organizationId: input.organizationId,
    });
    if (snap) {
      console.warn("[tiktok-bc] budget_snapshot_found_on_alt_bc", {
        requestedBcId: primaryBc,
        resolvedBcId: altBc,
        advertiserId,
      });
      return { bcId: altBc, snapshot: snap };
    }
  }

  throw new Error(
    "Esa cuenta no aparece en el BM de TikTok (finance). Probá otra cuenta Aprobada (BM 10/30) o corregí el advertiser ID.",
  );
}

export async function increaseSharedBmAdvertiserBudget(input: {
  bcId: string;
  advertiserId: string;
  /** USD a sumar al presupuesto actual (1:1 con cartera Holistic). */
  increaseAmountUsd: number;
  organizationId?: string;
}): Promise<{
  ok: true;
  previousBudget: number;
  newBudget: number;
  budgetMode: string;
  tiktokRequestId: string | null;
}> {
  const advertiserId = input.advertiserId.trim();
  const increase = Math.round(input.increaseAmountUsd * 100) / 100;

  if (!input.bcId.trim() || !advertiserId) {
    throw new Error("Falta bc_id o advertiser_id para subir presupuesto.");
  }
  if (!Number.isFinite(increase) || increase <= 0) {
    throw new Error("Monto de presupuesto inválido.");
  }
  if (increase > 50_000) {
    throw new Error("Monto fuera de rango seguro.");
  }

  const { bcId, snapshot } = await resolveSharedBudgetSnapshot({
    bcId: input.bcId,
    advertiserId,
    organizationId: input.organizationId,
  });

  const previousBudget = snapshot.budget;
  const budgetMode =
    snapshot.budgetMode === "DAILY_BUDGET" ||
    snapshot.budgetMode === "MONTHLY_BUDGET" ||
    snapshot.budgetMode === "CUSTOM_BUDGET" ||
    snapshot.budgetMode === "UNLIMITED"
      ? snapshot.budgetMode
      : "CUSTOM_BUDGET";

  if (snapshot.budgetMode === "UNLIMITED") {
    console.info("[tiktok-bc] budget_already_unlimited", {
      bcId,
      advertiserId,
      increase,
    });
    return {
      ok: true,
      previousBudget: snapshot.budget,
      newBudget: snapshot.budget,
      budgetMode: "UNLIMITED",
      tiktokRequestId: null,
    };
  }

  const newBudget = Math.round((previousBudget + increase) * 100) / 100;

  const { token: accessToken, source: tokenSource } =
    await resolveTikTokFinanceAccessToken(input.organizationId);
  const tokenFp = tokenFingerprint(accessToken);

  // TikTok: INCREMENTAL_UPDATE = sumar al presupuesto (no absoluto).
  // Allowed: INCREMENTAL_UPDATE | ONE_CLICK_SET | RESET | UPDATE
  const body = {
    bc_id: bcId,
    budget_update_type: "INCREMENTAL_UPDATE",
    advertiser_budgets: [
      {
        advertiser_id: advertiserId,
        budget: increase,
        budget_mode: budgetMode,
      },
    ],
  };

  console.info("[tiktok-bc] budget_increase_attempt", {
    bcId,
    advertiserId,
    previousBudget,
    newBudget,
    increase,
    budgetMode,
    tokenSource,
    tokenFp,
  });

  const response = await fetch(apiUrl("/advertiser/update/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": accessToken,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await response.json()) as TikTokApiResponse<Record<string, unknown>> & {
    log_id?: string;
  };

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    const detail = json.message ?? `HTTP ${response.status}`;
    console.error("[tiktok-bc] budget_increase_failed", {
      code: json.code ?? null,
      message: detail,
      bcId,
      advertiserId,
      previousBudget,
      newBudget,
      tokenSource,
      tokenFp,
      tiktokRequestId: json.request_id ?? json.log_id ?? null,
    });

    if (
      json.code === 40001 ||
      /does not grant you|advertiser\/update|permission/i.test(detail)
    ) {
      throw new Error(
        "No se pudo asignar en esta cuenta todavía (falta permiso de presupuesto en TikTok). Contactá a soporte.",
      );
    }

    if (json.code === 52404 || /internal error/i.test(detail)) {
      throw new Error(
        "TikTok rechazó el presupuesto de esa cuenta. Probá otra cuenta Aprobada del mismo BM.",
      );
    }

    throw new Error(
      "No se pudo completar la asignación en TikTok. No se debitó nada en Holistic. Contactá a soporte.",
    );
  }

  console.info("[tiktok-bc] budget_increase_ok", {
    bcId,
    advertiserId,
    previousBudget,
    newBudget,
    budgetMode,
    tiktokRequestId: json.request_id ?? null,
  });

  return {
    ok: true,
    previousBudget,
    newBudget,
    budgetMode,
    tiktokRequestId: json.request_id ?? null,
  };
}

/**
 * BM SHARED: bajar presupuesto (cuenta baneada / recuperar cupo).
 * Usa UPDATE absoluto = previous − decrease (mínimo 0).
 */
export async function decreaseSharedBmAdvertiserBudget(input: {
  bcId: string;
  advertiserId: string;
  decreaseAmountUsd: number;
  organizationId?: string;
}): Promise<{
  ok: true;
  previousBudget: number;
  newBudget: number;
  tiktokRequestId: string | null;
}> {
  const bcId = input.bcId.trim();
  const advertiserId = input.advertiserId.trim();
  const decrease = Math.round(input.decreaseAmountUsd * 100) / 100;
  if (!bcId || !advertiserId) {
    throw new Error("Falta bc_id o advertiser_id para bajar presupuesto.");
  }
  if (!Number.isFinite(decrease) || decrease <= 0) {
    throw new Error("Monto de baja de presupuesto inválido.");
  }

  const snapshot = await getAdvertiserBudgetSnapshot({
    bcId,
    advertiserId,
    organizationId: input.organizationId,
  });
  if (!snapshot) {
    throw new Error(
      "No se pudo leer el presupuesto de esa cuenta en TikTok para recuperarlo.",
    );
  }
  if (snapshot.budgetMode === "UNLIMITED") {
    // Sin tope: no hay “saldo de presupuesto” que bajar.
    return {
      ok: true,
      previousBudget: snapshot.budget,
      newBudget: snapshot.budget,
      tiktokRequestId: null,
    };
  }

  const previousBudget = snapshot.budget;
  const newBudget = Math.max(0, Math.round((previousBudget - decrease) * 100) / 100);
  if (newBudget >= previousBudget) {
    return {
      ok: true,
      previousBudget,
      newBudget: previousBudget,
      tiktokRequestId: null,
    };
  }

  const budgetMode =
    snapshot.budgetMode === "DAILY_BUDGET" ||
    snapshot.budgetMode === "MONTHLY_BUDGET" ||
    snapshot.budgetMode === "CUSTOM_BUDGET"
      ? snapshot.budgetMode
      : "CUSTOM_BUDGET";

  const { token: accessToken, source: tokenSource } =
    await resolveTikTokFinanceAccessToken(input.organizationId);

  const body = {
    bc_id: bcId,
    budget_update_type: "UPDATE",
    advertiser_budgets: [
      {
        advertiser_id: advertiserId,
        budget: newBudget,
        budget_mode: budgetMode,
      },
    ],
  };

  console.info("[tiktok-bc] budget_decrease_attempt", {
    bcId,
    advertiserId,
    previousBudget,
    newBudget,
    decrease,
    budgetMode,
    tokenSource,
  });

  const response = await fetch(apiUrl("/advertiser/update/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": accessToken,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await response.json()) as TikTokApiResponse<Record<string, unknown>> & {
    log_id?: string;
  };

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    const detail = json.message ?? `HTTP ${response.status}`;
    console.error("[tiktok-bc] budget_decrease_failed", {
      code: json.code ?? null,
      message: detail,
      bcId,
      advertiserId,
      tiktokRequestId: json.request_id ?? json.log_id ?? null,
    });
    throw new Error(
      "No se pudo bajar el presupuesto en TikTok de esa cuenta. Contactá a soporte.",
    );
  }

  return {
    ok: true,
    previousBudget,
    newBudget,
    tiktokRequestId: json.request_id ?? null,
  };
}
