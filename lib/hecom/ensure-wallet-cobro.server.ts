import "server-only";
import {
  getPaymentIntentByIdInternal,
  mergePaymentIntentMetadata,
} from "@/lib/payments/payment-intents.server";
import { syncWalletDepositCobroBestEffort } from "@/lib/hecom/wallet-cobro-bridge.server";

function hecomCobroAlreadyOk(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  const sync = meta?.hecom_cobro_sync;
  return Boolean(
    sync &&
      typeof sync === "object" &&
      (sync as { ok?: boolean }).ok === true,
  );
}

/**
 * Bridge Hecom "Lo pagado" — reintentable; no lanza.
 *
 * Único punto de verdad: todo camino que deje un depósito en `succeeded` tiene
 * que pasar por acá, o el pago se acredita en la cartera pero nunca aparece en
 * cobros de Hecom (pasó con el bot de Yape y con los auto-aprobados por
 * comprobante: acreditaban y no registraban).
 */
export async function ensureHecomWalletCobroSynced(input: {
  intent: {
    id: string;
    amountCents: number;
    currency: string;
    provider: string;
    metadata: Record<string, unknown> | null;
    providerReference?: string | null;
  };
  webhookEventId?: string;
  providerReference?: string | null;
  ledgerJournalId?: string;
  succeededAt?: string;
  claimed?: boolean;
}): Promise<void> {
  const fresh = await getPaymentIntentByIdInternal(input.intent.id);
  const meta = {
    ...(fresh?.metadata ?? input.intent.metadata ?? {}),
  } as Record<string, unknown>;

  if (hecomCobroAlreadyOk(meta)) return;

  const creditRaw = meta.credit_amount_cents;
  const feeRaw = meta.fee_amount_cents;
  const grossUsdRaw = meta.gross_usd_cents;
  const creditCents =
    typeof creditRaw === "number"
      ? creditRaw
      : typeof creditRaw === "string"
        ? Number(creditRaw)
        : null;
  const feeCentsMeta =
    typeof feeRaw === "number"
      ? feeRaw
      : typeof feeRaw === "string"
        ? Number(feeRaw)
        : null;
  const grossUsdCents =
    typeof grossUsdRaw === "number"
      ? grossUsdRaw
      : typeof grossUsdRaw === "string"
        ? Number(grossUsdRaw)
        : null;
  const hecomClienteId =
    typeof meta.hecom_cliente_id === "string" ? meta.hecom_cliente_id : null;

  const paidAt = input.succeededAt ?? new Date().toISOString();
  const intentCurrency = (
    fresh?.currency ?? input.intent.currency
  ).toUpperCase();
  // Hecom Lo pagado opera en USD (crédito cartera), aunque el cargo sea PEN.
  const amountCentsForHecom =
    Number.isFinite(grossUsdCents as number) && (grossUsdCents as number) > 0
      ? (grossUsdCents as number)
      : intentCurrency === "USD"
        ? (fresh?.amountCents ?? input.intent.amountCents)
        : Number.isFinite(creditCents as number)
          ? (creditCents as number)
          : fresh?.amountCents ?? input.intent.amountCents;
  const feeCentsForHecom =
    Number.isFinite(feeCentsMeta as number) && intentCurrency === "USD"
      ? (feeCentsMeta as number)
      : Number.isFinite(creditCents as number) &&
          Number.isFinite(amountCentsForHecom)
        ? Math.max(0, amountCentsForHecom - (creditCents as number))
        : feeCentsMeta;

  const cobroSync = await syncWalletDepositCobroBestEffort({
    hecomClienteId,
    paymentIntentId: input.intent.id,
    amountCents: amountCentsForHecom,
    creditCents: Number.isFinite(creditCents as number)
      ? (creditCents as number)
      : null,
    feeCents: Number.isFinite(feeCentsForHecom as number)
      ? (feeCentsForHecom as number)
      : null,
    currency: "USD",
    paidAt,
    provider: fresh?.provider ?? input.intent.provider,
  });

  await mergePaymentIntentMetadata(input.intent.id, {
    ...(input.ledgerJournalId
      ? { ledger_journal_id: input.ledgerJournalId }
      : {}),
    ...(input.providerReference
      ? { provider_reference: input.providerReference }
      : {}),
    hecom_cobro_sync_claim:
      input.webhookEventId ?? meta.hecom_cobro_sync_claim ?? paidAt,
    hecom_cobro_sync: cobroSync
      ? {
          ok: cobroSync.ok,
          skipped: cobroSync.skipped ?? false,
          reason: cobroSync.reason ?? null,
          cobro_id: cobroSync.cobroId ?? null,
          codigo: cobroSync.codigo ?? null,
          periodo_resumen: cobroSync.periodoResumen ?? null,
          at: new Date().toISOString(),
          healed: input.claimed === false || input.claimed == null,
        }
      : null,
  });
}

/**
 * Igual que `ensureHecomWalletCobroSynced` pero nunca propaga: para los
 * caminos de auto-abono, donde registrar en Hecom no debe tumbar la recarga
 * que ya se acreditó.
 */
export async function ensureHecomWalletCobroSyncedBestEffort(
  input: Parameters<typeof ensureHecomWalletCobroSynced>[0],
): Promise<void> {
  try {
    await ensureHecomWalletCobroSynced(input);
  } catch (error) {
    console.error("[hecom-cobro-bridge] ensure failed (non-blocking)", {
      paymentIntentId: input.intent.id,
      error: error instanceof Error ? error.message : error,
    });
  }
}
