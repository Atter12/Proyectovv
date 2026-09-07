import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/env.server";

export type CobranaDeeplink = {
  key: string;
  label: string;
  url: string;
};

export type CobranaCharge = {
  id: string;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  method?: string | null;
  option?: string | null;
  paymentUrl?: string | null;
  code?: string | null;
  deeplinks?: CobranaDeeplink[];
  externalRef?: string | null;
  metadata?: Record<string, unknown> | null;
  paidAt?: string | null;
};

export type CreateCobranaChargeInput = {
  amountPen: number;
  concept: string;
  documentNumber: string;
  documentType?: "DNI" | "RUC";
  name?: string;
  lastname?: string;
  email?: string;
  phoneNumber?: string;
  externalRef: string;
  idempotencyKey: string;
  metadata?: Record<string, string | number | boolean | null>;
  dueDate?: string;
};

type CobranaErrorBody = {
  error?: {
    type?: string;
    code?: string;
    message?: string;
    param?: string;
  };
};

function apiBase(): string {
  return serverEnv.cobranaApiBaseUrl.replace(/\/$/, "");
}

function authHeader(): string {
  const key = serverEnv.cobranaSecretKey.trim();
  if (!key) throw new Error("COBRANA_SECRET_KEY no configurada.");
  return `Bearer ${key}`;
}

async function cobranaFetch<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: authHeader(),
    Accept: "application/json",
    ...(init.body ? { "Content-Type": "application/json" } : {}),
  };
  if (init.idempotencyKey) {
    headers["Idempotency-Key"] = init.idempotencyKey;
  }

  const res = await fetch(`${apiBase()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    cache: "no-store",
  });

  const raw = (await res.json().catch(() => null)) as T | CobranaErrorBody | null;
  if (!res.ok) {
    const err = (raw as CobranaErrorBody | null)?.error;
    const message =
      err?.message ||
      `Yape HTTP ${res.status}${err?.code ? ` (${err.code})` : ""}`;
    throw new Error(message);
  }
  return raw as T;
}

/** Monto PEN decimal (ej. 110.00) — Cobrana no usa centavos. */
export async function createCobranaCharge(
  input: CreateCobranaChargeInput,
): Promise<CobranaCharge> {
  const option = serverEnv.cobranaServicesOption;
  const feeMode = serverEnv.cobranaFeeMode;

  const body = {
    amount: Math.round(input.amountPen * 100) / 100,
    currency: "PEN",
    concept: input.concept,
    method: "services",
    option,
    feeMode,
    dueDate: input.dueDate,
    customer: {
      documentNumber: input.documentNumber.trim(),
      ...(input.documentType ? { documentType: input.documentType } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.lastname ? { lastname: input.lastname } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.phoneNumber ? { phoneNumber: input.phoneNumber } : {}),
    },
    externalRef: input.externalRef.slice(0, 100),
    metadata: {
      payment_intent_id: input.externalRef,
      ...(input.metadata ?? {}),
    },
  };

  return cobranaFetch<CobranaCharge>("/charges", {
    method: "POST",
    body: JSON.stringify(body),
    idempotencyKey: input.idempotencyKey,
  });
}

export async function getCobranaCharge(chargeId: string): Promise<CobranaCharge> {
  return cobranaFetch<CobranaCharge>(`/charges/${encodeURIComponent(chargeId)}`, {
    method: "GET",
  });
}

/**
 * Verifica `X-Cobrana-Signature: t=…,v1=…`
 * HMAC_SHA256(secret, `${t}.${rawBody}`) comparado con v1 (timing-safe).
 */
export function verifyCobranaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret = serverEnv.cobranaWebhookSecret,
  nowSec = Math.floor(Date.now() / 1000),
  maxSkewSec = 300,
): boolean {
  if (!secret || !signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  ) as Record<string, string>;

  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > maxSkewSec) return false;

  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`, "utf8")
    .digest("hex");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(v1, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isCobranaConfigured(): boolean {
  return Boolean(serverEnv.cobranaSecretKey.trim());
}
