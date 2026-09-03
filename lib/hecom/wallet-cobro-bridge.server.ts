import "server-only";
import { serverEnv } from "@/lib/env/env.server";

export type HolisticWalletCobroPayload = {
  clientId: string;
  paymentIntentId: string;
  /** Gerencia: cobro Hecom = bruto cobrado al cliente. */
  montoBruto: number;
  montoNeto?: number;
  feeHolistic?: number;
  currency?: string;
  paidAt?: string | null;
  receiptUrl?: string | null;
  dryRun?: boolean;
};

export type HolisticWalletCobroResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  idempotent?: boolean;
  created?: boolean;
  dryRun?: boolean;
  cobroId?: string;
  codigo?: string;
  periodoResumen?: string | null;
  status: number;
  raw?: unknown;
};

function bridgeConfigured(): boolean {
  return Boolean(
    serverEnv.hecomCobrosBridgeUrl && serverEnv.hecomCobrosBridgeSecret,
  );
}

/**
 * POST cobro a Hecom (Ads Holistic · Stripe).
 * Idempotente por codigo AH-STRIPE-{paymentIntentId}.
 * Soft-fail: no tumba el webhook de Stripe si Hecom cae.
 */
export async function postHolisticWalletCobroToHecom(
  input: HolisticWalletCobroPayload,
): Promise<HolisticWalletCobroResult> {
  if (!serverEnv.hecomCobrosBridgeEnabled) {
    return {
      ok: true,
      skipped: true,
      reason: "bridge_disabled",
      status: 0,
    };
  }
  if (!bridgeConfigured()) {
    console.warn("[hecom-cobro-bridge] missing URL/secret — skip");
    return {
      ok: true,
      skipped: true,
      reason: "bridge_not_configured",
      status: 0,
    };
  }

  const clientId = input.clientId.trim();
  const paymentIntentId = input.paymentIntentId.trim();
  if (!clientId || !paymentIntentId) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_client_or_pi",
      status: 0,
    };
  }
  if (!(input.montoBruto > 0)) {
    return {
      ok: false,
      skipped: true,
      reason: "invalid_monto_bruto",
      status: 0,
    };
  }

  const url = serverEnv.hecomCobrosBridgeUrl.replace(/\/$/, "");
  const body = {
    client_id: clientId,
    payment_intent_id: paymentIntentId,
    monto_bruto: Math.round(input.montoBruto * 100) / 100,
    monto_neto:
      input.montoNeto != null
        ? Math.round(input.montoNeto * 100) / 100
        : undefined,
    fee_holistic:
      input.feeHolistic != null
        ? Math.round(input.feeHolistic * 100) / 100
        : undefined,
    currency: (input.currency || "USD").toUpperCase(),
    paid_at: input.paidAt || new Date().toISOString(),
    receipt_url: input.receiptUrl || undefined,
    dry_run: Boolean(input.dryRun),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.hecomCobrosBridgeSecret}`,
        "x-holistic-cobros-secret": serverEnv.hecomCobrosBridgeSecret,
      },
      body: JSON.stringify(body),
    });
    const raw = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!res.ok || !raw?.ok) {
      console.error("[hecom-cobro-bridge] fail", {
        status: res.status,
        paymentIntentId,
        clientId,
        raw,
      });
      return {
        ok: false,
        status: res.status,
        reason: String(raw?.error || `http_${res.status}`),
        raw,
      };
    }
    return {
      ok: true,
      status: res.status,
      idempotent: Boolean(raw.idempotent),
      created: Boolean(raw.created),
      dryRun: Boolean(raw.dry_run),
      cobroId: raw.cobro_id ? String(raw.cobro_id) : undefined,
      codigo: raw.codigo ? String(raw.codigo) : undefined,
      periodoResumen:
        raw.periodo_resumen != null ? String(raw.periodo_resumen) : null,
      raw,
    };
  } catch (error) {
    console.error("[hecom-cobro-bridge] network", error);
    return {
      ok: false,
      status: 0,
      reason: error instanceof Error ? error.message : "network_error",
    };
  }
}

/** Best-effort tras depósito Stripe succeeded. Nunca lanza. */
export async function syncWalletDepositCobroBestEffort(input: {
  hecomClienteId: string | null | undefined;
  paymentIntentId: string;
  amountCents: number;
  creditCents?: number | null;
  feeCents?: number | null;
  currency?: string;
  paidAt?: string | null;
  provider: string;
}): Promise<HolisticWalletCobroResult | null> {
  if (input.provider !== "stripe") {
    return { ok: true, skipped: true, reason: "not_stripe", status: 0 };
  }
  const clientId = input.hecomClienteId?.trim();
  if (!clientId) {
    console.warn("[hecom-cobro-bridge] stripe deposit without hecom_cliente_id", {
      paymentIntentId: input.paymentIntentId,
    });
    return {
      ok: true,
      skipped: true,
      reason: "no_hecom_cliente_id",
      status: 0,
    };
  }

  const bruto = input.amountCents / 100;
  const neto =
    input.creditCents != null ? input.creditCents / 100 : undefined;
  const fee = input.feeCents != null ? input.feeCents / 100 : undefined;

  const result = await postHolisticWalletCobroToHecom({
    clientId,
    paymentIntentId: input.paymentIntentId,
    montoBruto: bruto,
    montoNeto: neto,
    feeHolistic: fee,
    currency: input.currency,
    paidAt: input.paidAt,
  });

  if (!result.ok && !result.skipped) {
    console.error("[hecom-cobro-bridge] sync failed (non-blocking)", result);
  } else if (result.created || result.idempotent) {
    console.info("[hecom-cobro-bridge] sync ok", {
      paymentIntentId: input.paymentIntentId,
      cobroId: result.cobroId,
      idempotent: result.idempotent,
      periodo: result.periodoResumen,
    });
  }
  return result;
}
