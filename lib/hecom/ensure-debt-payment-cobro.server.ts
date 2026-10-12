import "server-only";
import { ensureHecomMissingCobroFromClaim } from "@/lib/hecom/ensure-missing-cobro.server";
import { mergePaymentIntentMetadata } from "@/lib/payments/payment-intents.server";

const METODO_BY_PROVIDER: Record<string, string> = {
  whop: "Whop",
  stripe: "Stripe",
};

/**
 * Pago de deuda del link Lo pagado cobrado por pasarela (Whop): registra en Hecom
 * el monto de la deuda en el mes de la deuda. El recargo de la tarjeta no entra al
 * cobro. Idempotente por `C-MISS-{payment_intent_id}`; no lanza.
 */
export async function ensureDebtPaymentCobroSynced(input: {
  intent: {
    id: string;
    amountCents: number;
    provider: string;
    metadata: Record<string, unknown> | null;
  };
  providerReference?: string | null;
  paidAt?: string;
}): Promise<void> {
  const meta = input.intent.metadata ?? {};
  const prev = meta.hecom_debt_payment_sync as { ok?: boolean } | undefined;
  if (prev?.ok === true) return;

  const hecomClienteId =
    typeof meta.hecom_cliente_id === "string" ? meta.hecom_cliente_id : "";
  const periodo = String(meta.periodo_resumen ?? "").trim();
  const creditCents = Number(meta.credit_amount_cents);
  const montoCents =
    Number.isFinite(creditCents) && creditCents > 0 ? creditCents : input.intent.amountCents;
  const paidAt = input.paidAt ?? new Date().toISOString();

  try {
    const cobro = await ensureHecomMissingCobroFromClaim({
      hecomClienteId,
      paymentIntentId: input.intent.id,
      montoUsd: montoCents / 100,
      periodoResumen: periodo,
      fecha: paidAt.slice(0, 10),
      metodo: METODO_BY_PROVIDER[input.intent.provider] ?? input.intent.provider,
      operationCode: input.providerReference ?? null,
      notas: "Pago de deuda · link Lo pagado (tarjeta)",
      approvedByEmail: null,
    });
    await mergePaymentIntentMetadata(input.intent.id, {
      hecom_debt_payment_sync: {
        ok: cobro.ok,
        cobro_id: cobro.cobroId,
        codigo: cobro.codigo,
        periodo_resumen: periodo,
        monto_usd_cents: montoCents,
        reason: cobro.reason ?? null,
        at: new Date().toISOString(),
      },
    });
    if (!cobro.ok) {
      console.error("[debt-payment-cobro] hecom sync failed", {
        paymentIntentId: input.intent.id,
        reason: cobro.reason,
      });
    }
  } catch (error) {
    console.error("[debt-payment-cobro] hecom sync threw", {
      paymentIntentId: input.intent.id,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
