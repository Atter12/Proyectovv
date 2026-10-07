import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Comisiones de aliados: por cada recarga confirmada de un cliente referido,
 * el aliado gana `commission_rate` × el fee que Holistic cobró en ese pago.
 *
 * - Solo recargas reales del cliente (source = dashboard): no cuentan los
 *   ajustes de staff, saldos a favor ni puentes desde el BM.
 * - Fee de Holistic en USD = crédito × fee_holistic_percent. Deja fuera el
 *   recargo de Stripe, que no es ganancia nuestra.
 * - Solo pagos entre la atribución y su vencimiento (commission_days).
 * - Idempotente: una comisión por pago (payment_intent_id único).
 */

type PartnerClientRow = {
  partner_id: string;
  hecom_cliente_id: string;
  attributed_at: string;
  expires_at: string;
};

type IntentRow = {
  id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Fee de Holistic de un pago, en centavos USD (0 si no se puede saber). */
export function holisticFeeUsdCents(metadata: Record<string, unknown> | null): number {
  const m = metadata ?? {};
  const credit = num(m.credit_amount_cents);
  const pct = num(m.fee_holistic_percent);
  const creditCurrency = String(m.wallet_credit_currency ?? "USD").toUpperCase();
  if (credit != null && pct != null && creditCurrency === "USD") {
    return Math.max(0, Math.round((credit * pct) / 100));
  }
  // Pagos antiguos sin desglose: sin recargo de pasarela el fee total es el de Holistic.
  const surcharge = num(m.fee_stripe_surcharge_percent) ?? 0;
  const fee = num(m.fee_amount_cents);
  return surcharge === 0 && fee != null ? Math.max(0, Math.round(fee)) : 0;
}

export async function syncPartnerCommissions(): Promise<{ scanned: number; created: number }> {
  const admin = createAdminClient();

  const { data: clients, error } = await admin
    .from("partner_clients")
    .select("partner_id,hecom_cliente_id,attributed_at,expires_at");
  if (error) throw new Error(error.message);
  if (!clients?.length) return { scanned: 0, created: 0 };

  const { data: partners } = await admin.from("partners").select("id,commission_rate");
  const rateById = new Map((partners ?? []).map((p) => [p.id as string, Number(p.commission_rate)]));

  let scanned = 0;
  let created = 0;
  for (const client of clients as PartnerClientRow[]) {
    const rate = rateById.get(client.partner_id);
    if (!rate) continue;

    const { data: intents, error: intentsError } = await admin
      .from("payment_intents")
      .select("id,created_at,metadata")
      .eq("status", "succeeded")
      .eq("metadata->>hecom_cliente_id", client.hecom_cliente_id)
      .eq("metadata->>source", "dashboard")
      .gte("created_at", client.attributed_at)
      .lte("created_at", client.expires_at)
      .limit(1000);
    if (intentsError) {
      console.warn("[partner-commissions] intents_failed", { error: intentsError.message });
      continue;
    }

    const rows = (intents as IntentRow[] | null ?? [])
      .map((intent) => {
        const fee = holisticFeeUsdCents(intent.metadata);
        return {
          partner_id: client.partner_id,
          hecom_cliente_id: client.hecom_cliente_id,
          payment_intent_id: intent.id,
          fee_cents: fee,
          rate,
          commission_cents: Math.round(fee * rate),
          currency: "USD",
          earned_at: intent.created_at,
        };
      })
      .filter((row) => row.commission_cents > 0);
    scanned += intents?.length ?? 0;
    if (!rows.length) continue;

    const { data: inserted, error: insertError } = await admin
      .from("partner_commissions")
      .upsert(rows, { onConflict: "payment_intent_id", ignoreDuplicates: true })
      .select("id");
    if (insertError) {
      console.warn("[partner-commissions] insert_failed", { error: insertError.message });
      continue;
    }
    created += inserted?.length ?? 0;
  }
  return { scanned, created };
}
