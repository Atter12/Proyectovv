import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cancelCobranaCharge,
  getCobranaCharge,
} from "@/lib/payments/cobrana/client.server";
import { updatePaymentIntentRecord } from "@/lib/payments/payment-intents.server";

/**
 * Yape (Cobrana) obliga a pagar los recibos del más antiguo al más nuevo. Si el
 * cliente generó una recarga y no la pagó, la siguiente queda bloqueada con
 * «Pago no válido». Al crear un recibo nuevo se cancelan los pendientes
 * anteriores del mismo cliente.
 *
 * - Solo se cancela lo que Cobrana confirma como «pending»: si ya se pagó, se
 *   deja quieto y el webhook lo acredita.
 * - Nunca frena la recarga nueva: cualquier error se registra y sigue.
 */
type StaleIntent = {
  id: string;
  metadata: Record<string, unknown> | null;
};

const OPEN_STATUSES = ["created", "requires_payment", "processing"];

export async function cancelStaleCobranaCharges(input: {
  organizationId: string;
  hecomClienteId: string | null;
  documentNumber: string | null;
  keepIntentId: string;
}): Promise<{ cancelled: number; skipped: number }> {
  let query = createAdminClient()
    .from("payment_intents")
    .select("id,metadata")
    .eq("provider", "cobrana")
    .in("status", OPEN_STATUSES)
    .neq("id", input.keepIntentId)
    .order("created_at", { ascending: true })
    .limit(30);
  // Yape agrupa los recibos por DNI, no por organización: si el mismo DNI tiene
  // dos fichas/orgs, el recibo viejo de la otra bloquea el nuevo (Piero Acasiete,
  // 23/10/2026: ficha [DUP] y ficha real, S/ 370.70 + S/ 96.38 pendientes).
  // Por eso se busca por DNI en todas las orgs; sin DNI, el mismo cliente en su org.
  const documentNumber = input.documentNumber?.trim();
  if (documentNumber) {
    query = query.eq("metadata->>customer_document_number", documentNumber);
  } else if (input.hecomClienteId) {
    query = query
      .eq("organization_id", input.organizationId)
      .eq("metadata->>hecom_cliente_id", input.hecomClienteId);
  } else {
    return { cancelled: 0, skipped: 0 };
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[cobrana] stale_lookup_failed", { error: error.message });
    return { cancelled: 0, skipped: 0 };
  }

  let cancelled = 0;
  let skipped = 0;
  for (const intent of (data ?? []) as StaleIntent[]) {
    const chargeId = String(intent.metadata?.cobrana_charge_id ?? "").trim();
    if (!chargeId) {
      skipped += 1;
      continue;
    }
    try {
      const charge = await getCobranaCharge(chargeId);
      const status = String(charge.status ?? "").toLowerCase();
      if (status !== "pending") {
        // Pagado o ya cerrado en Cobrana: no se toca (el webhook manda).
        skipped += 1;
        continue;
      }
      await cancelCobranaCharge(chargeId);
      await updatePaymentIntentRecord(intent.id, {
        status: "cancelled",
        canceledAt: new Date().toISOString(),
        failureReason: "Reemplazado por un recibo de Yape más nuevo.",
        metadata: {
          ...(intent.metadata ?? {}),
          cobrana_cancelled_reason: "superseded",
          cobrana_superseded_by: input.keepIntentId,
        },
      });
      cancelled += 1;
    } catch (cause) {
      skipped += 1;
      console.warn("[cobrana] stale_cancel_failed", {
        intentId: intent.id,
        error: cause instanceof Error ? cause.message : "unknown",
      });
    }
  }
  if (cancelled > 0) {
    console.info("[cobrana] stale_cancelled", {
      organizationId: input.organizationId,
      keepIntentId: input.keepIntentId,
      cancelled,
      skipped,
    });
  }
  return { cancelled, skipped };
}
