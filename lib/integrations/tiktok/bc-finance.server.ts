import { serverEnv } from "@/lib/env/env.server";
import { getTikTokConnection } from "@/lib/integrations/tiktok/client.server";

interface TikTokApiResponse<T> {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
}

export type TikTokBcTransferType = "RECHARGE" | "DEDUCT";

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
    input.code === 40002 ||
    /params invalid|invalid param|cash_amount|insufficient.*(cash|balance|fund)/i.test(
      input.message,
    )
  ) {
    return "No se pudo mover saldo a esa cuenta desde su BM. Suele ser: el BM no tiene cash disponible, o la cuenta no está lista en TikTok. Probá una cuenta de BM 200 o pedile a soporte que revise el BM.";
  }

  return "No se pudo asignar el saldo en TikTok ahora. Tu dinero sigue en la cartera Holistic. Probá otra cuenta o contactá soporte.";
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
  if (!input.requestId.trim()) {
    throw new Error("request_id es obligatorio (idempotencia).");
  }

  const { token: accessToken, source: tokenSource } =
    await resolveTikTokFinanceAccessToken(input.organizationId);
  const tokenFp = tokenFingerprint(accessToken);

  // Evitar 40002 críptico: si el BM no tiene cash, fallar con mensaje claro.
  const cashAvailable = await getBcCashBalance({
    bcId,
    organizationId: input.organizationId,
  });
  if (cashAvailable != null && cashAvailable + 1e-9 < cashAmount) {
    console.warn("[tiktok-bc] transfer_blocked_no_cash", {
      bcId,
      advertiserId,
      cashAmount,
      cashAvailable,
      tokenSource,
      tokenFp,
    });
    throw new Error(
      cashAvailable <= 0
        ? "Este Business Center no tiene cash disponible para asignar. Tu saldo sigue en la cartera Holistic. Probá una cuenta de otro BM (ej. BM 200) o pedile a soporte que fondee ese BM."
        : `Este BM solo tiene ~$${cashAvailable.toFixed(2)} cash. Pedí menos o usá otra cuenta/BM. Tu saldo sigue en la cartera Holistic.`,
    );
  }

  const body = {
    bc_id: bcId,
    advertiser_id: advertiserId,
    transfer_type: transferType,
    cash_amount: Math.round(cashAmount * 100) / 100,
    request_id: input.requestId.trim(),
  };

  console.info("[tiktok-bc] transfer_attempt", {
    bcId,
    advertiserId,
    cashAmount: body.cash_amount,
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
      cashAmount: body.cash_amount,
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
    cashAmount: body.cash_amount,
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
    raw: (json.data ?? {}) as Record<string, unknown>,
  };
}

export async function getBcCashBalance(input: {
  bcId: string;
  organizationId?: string;
}): Promise<number | null> {
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
    balance?: number | string;
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

  const raw =
    json.data?.valid_cash_balance ?? json.data?.cash_balance ?? json.data?.balance;
  if (raw === undefined || raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
