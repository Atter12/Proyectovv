import { serverEnv } from "@/lib/env/env.server";
import { getTikTokConnection } from "@/lib/integrations/tiktok/client.server";

interface TikTokApiResponse<T> {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
}

export type TikTokBcTransferType = "RECHARGE" | "DEDUCT";

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
}): Record<string, unknown> {
  const amount = Math.round(input.amount * 100) / 100;
  const body: Record<string, unknown> = {
    bc_id: input.bcId,
    advertiser_id: input.advertiserId,
    transfer_type: input.transferType,
    request_id: input.requestId.trim(),
  };
  if (input.fundingSource === "grant") {
    body.grant_amount = amount;
  } else {
    body.cash_amount = amount;
  }
  return body;
}

/**
 * Mueve cash del Business Center → advertiser (o al revés con DEDUCT).
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

  // BM 10/30 suelen ser SHARED: Manager muestra "línea de crédito" (account_balance)
  // pero cash_balance=0. La API solo acepta cash_amount o grant_amount (cupones),
  // NO la línea de crédito compartida.
  const balanceDetail = await getBcBalanceDetail({
    bcId,
    organizationId: input.organizationId,
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

  const body = buildTransferBody({
    bcId,
    advertiserId,
    transferType,
    amount: cashAmount,
    fundingSource: funding.source,
    requestId: input.requestId,
  });

  console.info("[tiktok-bc] transfer_attempt", {
    bcId,
    advertiserId,
    amount: cashAmount,
    fundingSource: funding.source,
    fundingAvailable: funding.available,
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
      fundingSource: funding.source,
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
    fundingSource: funding.source,
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
    fundingSource: funding.source,
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
}): Promise<BcBalanceDetail | null> {
  const { token: accessToken, source: tokenSource } =
    await resolveTikTokFinanceAccessToken(input.organizationId);
  const url = new URL(apiUrl("/bc/balance/get/"));
  url.searchParams.set("bc_id", input.bcId.trim());

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

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    console.warn("[tiktok-bc] balance_get_failed", {
      code: json.code ?? null,
      message: json.message ?? null,
      bcId: input.bcId,
      tokenSource,
      tokenFp: tokenFingerprint(accessToken),
      tiktokRequestId: json.request_id ?? null,
    });
    return null;
  }

  const num = (v: number | string | null | undefined): number | null => {
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    cashBalance: num(json.data?.cash_balance ?? json.data?.balance),
    validCashBalance: num(json.data?.valid_cash_balance),
    grantBalance: num(json.data?.grant_balance),
    validGrantBalance: num(json.data?.valid_grant_balance),
    accountBalance: num(json.data?.account_balance),
    validAccountBalance: num(json.data?.valid_account_balance),
    paymentPortfolioType: json.data?.payment_portfolio_type
      ? String(json.data.payment_portfolio_type)
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
