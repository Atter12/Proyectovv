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

/**
 * Token para finance BC:
 * 1) OAuth de la org (si existe)
 * 2) TIKTOK_ACCESS_TOKEN de agencia (env)
 */
export async function resolveTikTokFinanceAccessToken(
  organizationId?: string,
): Promise<string> {
  if (organizationId) {
    try {
      const connection = await getTikTokConnection(organizationId);
      if (connection?.accessToken) return connection.accessToken;
    } catch {
      // fallback a token de agencia
    }
  }

  const agency = serverEnv.tiktokAccessToken.trim();
  if (agency) return agency;

  throw new Error(
    "Sin token TikTok para fondear BM. Conectá TikTok en la org o configurá TIKTOK_ACCESS_TOKEN.",
  );
}

export function isTikTokBcFundingEnabled(): boolean {
  return serverEnv.tiktokBcFundingEnabled;
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

  const accessToken = await resolveTikTokFinanceAccessToken(input.organizationId);

  const body = {
    bc_id: bcId,
    advertiser_id: advertiserId,
    transfer_type: transferType,
    cash_amount: Math.round(cashAmount * 100) / 100,
    request_id: input.requestId.trim(),
  };

  const response = await fetch(apiUrl("/bc/transfer/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": accessToken,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await response.json()) as TikTokApiResponse<Record<string, unknown>>;

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    const detail = json.message ?? `HTTP ${response.status}`;
    console.error("[tiktok-bc] transfer_failed", {
      code: json.code ?? null,
      message: detail,
      bcId,
      advertiserId,
      cashAmount,
      transferType,
      requestId: input.requestId,
      tiktokRequestId: json.request_id ?? null,
    });
    throw new Error(`TikTok BC transfer falló: ${detail}`);
  }

  console.info("[tiktok-bc] transfer_ok", {
    bcId,
    advertiserId,
    cashAmount,
    transferType,
    requestId: input.requestId,
    tiktokRequestId: json.request_id ?? null,
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
  const accessToken = await resolveTikTokFinanceAccessToken(input.organizationId);
  const url = new URL(apiUrl("/bc/balance/get/"));
  url.searchParams.set("bc_id", input.bcId.trim());

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Access-Token": accessToken },
    cache: "no-store",
  });

  const json = (await response.json()) as TikTokApiResponse<{
    cash_balance?: number | string;
    balance?: number | string;
  }>;

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    console.warn("[tiktok-bc] balance_get_failed", {
      code: json.code ?? null,
      message: json.message ?? null,
      bcId: input.bcId,
    });
    return null;
  }

  const raw = json.data?.cash_balance ?? json.data?.balance;
  if (raw === undefined || raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
