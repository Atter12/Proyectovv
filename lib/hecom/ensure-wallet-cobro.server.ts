import "server-only";
import { createHash } from "node:crypto";
import {
  getPaymentIntentByIdInternal,
  mergePaymentIntentMetadata,
} from "@/lib/payments/payment-intents.server";
import { syncWalletDepositCobroBestEffort } from "@/lib/hecom/wallet-cobro-bridge.server";
import { buildWalletFunding } from "@/lib/hecom/wallet-funding";

function hecomCobroAlreadyOk(
  meta: Record<string, unknown> | null | undefined,
  fingerprint: string | null,
): boolean {
  const sync = meta?.hecom_cobro_sync;
  return Boolean(
    sync &&
      typeof sync === "object" &&
      (sync as { ok?: boolean }).ok === true &&
      (sync as { skipped?: boolean }).skipped !== true &&
      (sync as { funding_version?: number }).funding_version === 1 &&
      fingerprint !== null &&
      (sync as { funding_fingerprint?: string }).funding_fingerprint === fingerprint,
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

  const hecomClienteId =
    typeof meta.hecom_cliente_id === "string" ? meta.hecom_cliente_id : null;
  const sourceIntent = { ...(fresh ?? input.intent), metadata: meta };
  const provider = (fresh?.provider ?? input.intent.provider).toLowerCase();
  const funding = hecomClienteId ? buildWalletFunding(sourceIntent, {
    clientId: hecomClienteId, paymentIntentId: input.intent.id, provider,
    ledgerJournalId: input.ledgerJournalId,
  }) : null;
  const fingerprint = funding ? createHash("sha256").update(JSON.stringify(funding)).digest("hex") : null;
  if (hecomCobroAlreadyOk(meta, fingerprint)) return;
  const previousSync = meta.hecom_cobro_sync;
  const fundingOnly = Boolean(previousSync && typeof previousSync === "object" &&
    ((previousSync as { funding_only?: boolean }).funding_only === true ||
      ((previousSync as { ok?: boolean }).ok === true &&
        (previousSync as { skipped?: boolean }).skipped !== true)));

  const paidAt = input.succeededAt ?? new Date().toISOString();

  const cobroSync = await syncWalletDepositCobroBestEffort({
    hecomClienteId,
    paymentIntentId: input.intent.id,
    amountCents: sourceIntent.amountCents,
    currency: "USD",
    paidAt,
    provider,
    sourceIntent,
    ledgerJournalId: input.ledgerJournalId,
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
          // Keep evidence of prior existence through failures (including 404).
          // A later retry must not recreate a removed receipt or relabel it.
          ...(fundingOnly ? { funding_only: true } : {}),
          ...(cobroSync.ok && !cobroSync.skipped && cobroSync.fundingVersion === 1 &&
              cobroSync.fundingPersisted === true && fingerprint
            ? { funding_version: 1, funding_fingerprint: fingerprint }
            : {}),
        }
      : fundingOnly
        ? { ok: false, skipped: true, reason: "sync_result_missing", funding_only: true }
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
