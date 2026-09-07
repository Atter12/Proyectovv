import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRecord, getNumber, getString } from "@/lib/records";

/**
 * Historial de recargas de la cartera.
 *
 * Lee del ledger y no de `wallet_transactions`: esa tabla quedó vacía cuando la
 * plataforma pasó al libro de doble entrada (0 filas contra 51 depósitos
 * reales), y todo lo que la consultaba muestra "sin registros" para siempre.
 *
 * Muestra el bruto cobrado, la comisión y el neto acreditado por separado,
 * porque en soles el cliente paga un número y recibe otro: sin el desglose
 * parece que le faltó plata.
 */

export interface RechargeHistoryItem {
  id: string;
  date: string;
  /** Cómo pagó: Yape, transferencia, tarjeta. */
  method: string;
  /** Lo que efectivamente entró a la cartera. */
  creditUsdCents: number;
  /** Lo cobrado, en la moneda del cobro. */
  grossAmount: number;
  grossCurrency: string;
  feeAmountCents: number;
  status: "acreditada" | "en_revision" | "esperando_pago" | "cancelada";
  /** Quién la aprobó: el cobro real del banco, la IA, o una persona. */
  approvedBy: "banco" | "comprobante" | "equipo" | null;
  operationNumber: string | null;
}

interface IntentRow {
  id: string;
  provider: string;
  status: string;
  currency: string;
  amount_cents: number;
  created_at: string;
  succeeded_at: string | null;
  metadata: Record<string, unknown> | null;
}

function readMethod(row: IntentRow): string {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  if (row.provider === "manual" && metadata.charge_currency === "PEN") {
    return "Yape / Plin";
  }
  if (row.provider === "manual") return "Transferencia";
  if (row.provider === "stripe") return "Tarjeta (Stripe)";
  return row.provider;
}

function readStatus(status: string): RechargeHistoryItem["status"] {
  if (status === "succeeded") return "acreditada";
  if (status === "processing") return "en_revision";
  if (status === "cancelled" || status === "failed") return "cancelada";
  return "esperando_pago";
}

function readApprovedBy(
  metadata: Record<string, unknown>,
): RechargeHistoryItem["approvedBy"] {
  const source = getString(metadata.approval_source);
  if (source === "bank_notification") return "banco";
  if (source === "voucher_ai") return "comprobante";
  if (source) return "equipo";
  return null;
}

/** Recargas de la organización, de la más reciente a la más vieja. */
export async function getRechargeHistory(
  organizationId: string,
  limit = 20,
): Promise<RechargeHistoryItem[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select(
      "id, provider, status, currency, amount_cents, created_at, succeeded_at, metadata",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as IntentRow[]).map((row) => {
    const metadata = isRecord(row.metadata) ? row.metadata : {};
    const creditUsdCents =
      getNumber(metadata.credit_amount_cents) ?? row.amount_cents;
    const grossPenCents = getNumber(metadata.gross_pen_cents);
    const isPen = metadata.charge_currency === "PEN" && grossPenCents !== null;

    return {
      id: row.id,
      date: row.succeeded_at ?? row.created_at,
      method: readMethod(row),
      creditUsdCents: Math.round(creditUsdCents),
      grossAmount: isPen ? grossPenCents : row.amount_cents,
      grossCurrency: isPen ? "PEN" : row.currency,
      feeAmountCents: Math.max(
        0,
        Math.round((getNumber(metadata.fee_amount_cents) ?? 0)),
      ),
      status: readStatus(row.status),
      approvedBy: readApprovedBy(metadata),
      operationNumber:
        getString(metadata.bank_confirmation_operation_number) ??
        getString(metadata.voucher_operation_code),
    };
  });
}
