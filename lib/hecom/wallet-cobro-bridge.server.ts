import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import { getPaymentIntentByIdInternal } from "@/lib/payments/payment-intents.server";
import { buildWalletFunding, type WalletFunding, type WalletFundingIntent } from "@/lib/hecom/wallet-funding";

export type HolisticWalletCobroPayload = {
  clientId: string;
  paymentIntentId: string;
  /** Gerencia: cobro Hecom = bruto cobrado al cliente. */
  montoBruto: number;
  montoNeto?: number;
  feeHolistic?: number;
  currency?: string;
  /** Canal Holistic: stripe | manual (BCP) | cobrana (Yape) | crypto */
  provider?: string;
  paidAt?: string | null;
  receiptUrl?: string | null;
  dryRun?: boolean;
  funding?: WalletFunding;
  /** A prior successful sync proves the receipt existed; enrich only. */
  fundingOnly?: boolean;
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
  fundingVersion?: number;
  fundingPersisted?: boolean;
};

function bridgeConfigured(): boolean {
  return Boolean(
    serverEnv.hecomCobrosBridgeUrl && serverEnv.hecomCobrosBridgeSecret,
  );
}

/**
 * POST cobro a Hecom (Ads Holistic → Lo pagado).
 * Idempotente por codigo según canal:
 *   stripe → AH-STRIPE-{pi} · manual → AH-BCP-{pi} · cobrana → AH-YAPE-{pi}
 * Soft-fail: no tumba el webhook / aprobación si Hecom cae.
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

  const provider = String(input.provider || "stripe").trim().toLowerCase();
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
    provider,
    paid_at: input.paidAt || new Date().toISOString(),
    receipt_url: input.receiptUrl || undefined,
    dry_run: Boolean(input.dryRun),
    ...(input.funding ? { funding: input.funding } : {}),
    ...(input.fundingOnly ? { funding_only: true } : {}),
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
      fundingVersion: raw.funding_version === 1 ? 1 : undefined,
      fundingPersisted: raw.funding_persisted === true,
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

/**
 * Alinea `periodo_resumen` al mes de la fecha de pago.
 *
 * El endpoint de Hecom imputa el cobro al período más viejo que el cliente
 * tiene sin cubrir, no al mes en que entró la plata: un pago del 12/09 de un
 * cliente con deuda de agosto queda archivado en `2026-08`. Como el CRM filtra
 * por período y no por fecha de pago, el pago parece no haberse registrado.
 *
 * Gerencia pidió que el cobro viva en el mes en que se pagó, así que después de
 * crear el cobro lo re-archivamos. El mes sale de `cobros.fecha` (lo que el CRM
 * muestra como fecha de pago) y no de `paid_at`, para no desfasarnos por la
 * diferencia entre UTC y Lima en pagos cerca de medianoche.
 *
 * Best-effort: si falla, el cobro ya está creado; solo queda en el mes que
 * eligió Hecom.
 */
export async function alignCobroPeriodoToPaymentMonth(
  codigo: string,
): Promise<{ changed: boolean; from?: string | null; to?: string }> {
  if (process.env.HECOM_COBRO_PERIODO_ALIGN === "false") {
    return { changed: false };
  }
  // Solo los cobros que crea esta integración.
  if (!codigo.startsWith("AH-")) return { changed: false };

  try {
    const hecom = createHecomAdminClient();
    const { data: cobro, error } = await hecom
      .from("cobros")
      .select("id, fecha, periodo_resumen")
      .eq("codigo", codigo)
      .maybeSingle();
    if (error || !cobro?.fecha) return { changed: false };

    const mesPago = String(cobro.fecha).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mesPago)) return { changed: false };
    if (cobro.periodo_resumen === mesPago) return { changed: false };

    const { error: upError } = await hecom
      .from("cobros")
      .update({ periodo_resumen: mesPago })
      .eq("id", cobro.id);
    if (upError) {
      console.error("[hecom-cobro-bridge] periodo align failed", {
        codigo,
        error: upError.message,
      });
      return { changed: false };
    }

    console.info("[hecom-cobro-bridge] periodo alineado al mes de pago", {
      codigo,
      from: cobro.periodo_resumen,
      to: mesPago,
    });
    return { changed: true, from: cobro.periodo_resumen, to: mesPago };
  } catch (error) {
    console.error("[hecom-cobro-bridge] periodo align error", error);
    return { changed: false };
  }
}

/** Best-effort tras depósito succeeded (Stripe / manual / Yape). Nunca lanza. */
export async function syncWalletDepositCobroBestEffort(input: {
  hecomClienteId: string | null | undefined;
  paymentIntentId: string;
  amountCents: number;
  creditCents?: number | null;
  feeCents?: number | null;
  currency?: string;
  paidAt?: string | null;
  provider: string;
  /** Fresh authoritative intent supplied by ensure; direct callers are loaded here. */
  sourceIntent?: WalletFundingIntent;
  ledgerJournalId?: string;
}): Promise<HolisticWalletCobroResult | null> {
  const provider = String(input.provider || "").toLowerCase();
  if (!["stripe", "manual", "cobrana", "crypto"].includes(provider)) {
    return { ok: true, skipped: true, reason: "provider_not_bridged", status: 0 };
  }
  const clientId = input.hecomClienteId?.trim();
  if (!clientId) {
    console.warn("[hecom-cobro-bridge] deposit without hecom_cliente_id", {
      paymentIntentId: input.paymentIntentId,
      provider,
    });
    return {
      ok: true,
      skipped: true,
      reason: "no_hecom_cliente_id",
      status: 0,
    };
  }

  let intent: WalletFundingIntent | null;
  try {
    intent = input.sourceIntent ?? await getPaymentIntentByIdInternal(input.paymentIntentId);
  } catch {
    return { ok: false, skipped: true, reason: "funding_source_unavailable", status: 0 };
  }
  if (!intent) return { ok: false, skipped: true, reason: "funding_source_unavailable", status: 0 };
  const funding = buildWalletFunding(intent, {
    clientId, paymentIntentId: input.paymentIntentId, provider,
    ledgerJournalId: input.ledgerJournalId,
  });
  if (!funding) return { ok: false, skipped: true, reason: "funding_identity_or_amount_invalid", status: 0 };
  const previousSync = intent.metadata?.hecom_cobro_sync;
  const fundingOnly = Boolean(previousSync && typeof previousSync === "object" &&
    ((previousSync as { funding_only?: boolean }).funding_only === true ||
      ((previousSync as { ok?: boolean }).ok === true &&
        (previousSync as { skipped?: boolean }).skipped !== true)));

  // USD quote is frozen on the intent. Never send PEN as USD or the current fee.
  const bruto = funding.gross_cents / 100;
  const neto = funding.mode === "wallet_topup" ? funding.wallet_credit_cents / 100 : undefined;
  // Legacy display fields remain conservative; authoritative split is versioned.
  const fee = funding.mode === "wallet_topup" && funding.fee_holistic_percent !== null
    ? funding.holistic_fee_cents / 100 : undefined;

  const result = await postHolisticWalletCobroToHecom({
    clientId,
    paymentIntentId: input.paymentIntentId,
    montoBruto: bruto,
    montoNeto: neto,
    feeHolistic: fee,
    currency: "USD",
    provider,
    paidAt: input.paidAt,
    funding,
    fundingOnly,
  });

  if (!result.ok && !result.skipped) {
    console.error("[hecom-cobro-bridge] sync failed (non-blocking)", result);
    return result;
  }

  if (result.created || result.idempotent) {
    console.info("[hecom-cobro-bridge] sync ok", {
      paymentIntentId: input.paymentIntentId,
      provider,
      cobroId: result.cobroId,
      idempotent: result.idempotent,
      periodo: result.periodoResumen,
    });
  }

  // Only newly created receipts may be aligned. A metadata enrichment must
  // preserve the existing receipt's amount, client, date and accounting period.
  if (result.ok && result.created && !result.dryRun && result.codigo) {
    const aligned = await alignCobroPeriodoToPaymentMonth(result.codigo);
    if (aligned.changed && aligned.to) {
      return { ...result, periodoResumen: aligned.to };
    }
  }

  return result;
}
