import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { getNumber, isRecord } from "@/lib/records";
import {
  AmountReservationError,
  reserveUniquePenAmount,
} from "@/lib/payments/yape/reserve-amount.server";

export { AmountReservationError, reserveUniquePenAmount };

/**
 * Céntimos únicos en USD para pago manual del panel (BCP dólares / Binance).
 * Misma idea que Yape en soles: el mail no siempre trae N° de operación.
 */

const MAX_ATTEMPTS = 100;

function getWindowMinutes(): number {
  return serverEnv.yapeMatchWindowMinutes ?? 180;
}

function uniqueUsdEnabled(): boolean {
  return serverEnv.manualUniqueUsdCents;
}

export async function reserveUniqueUsdAmount(
  grossUsdCents: number,
): Promise<{ amountCents: number; discriminatorCents: number }> {
  if (!uniqueUsdEnabled()) {
    return { amountCents: grossUsdCents, discriminatorCents: 0 };
  }

  const taken = await getOpenUsdAmounts();

  let discriminatorCents = 0;
  while (
    discriminatorCents < MAX_ATTEMPTS &&
    taken.has(grossUsdCents + discriminatorCents)
  ) {
    discriminatorCents += 1;
  }

  if (discriminatorCents >= MAX_ATTEMPTS) {
    throw new AmountReservationError(
      "Hay demasiadas recargas abiertas por este monto en dólares. Prueba de nuevo en unos minutos o cambia el monto.",
    );
  }

  return {
    amountCents: grossUsdCents + discriminatorCents,
    discriminatorCents,
  };
}

async function getOpenUsdAmounts(): Promise<Set<number>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select("amount_cents, metadata")
    .eq("provider", "manual")
    .eq("currency", "USD")
    .in("status", ["created", "requires_payment", "processing"])
    .gte(
      "created_at",
      new Date(Date.now() - getWindowMinutes() * 60_000).toISOString(),
    );

  if (error) throw new AmountReservationError(error.message);

  const reserved = new Set<number>();
  for (const row of data ?? []) {
    const amount = readGrossUsdCents(
      row as { amount_cents?: number; metadata?: unknown },
    );
    if (amount !== null) reserved.add(amount);
  }
  return reserved;
}

/** Bruto en dólares que el cliente debe transferir (BCP USD / Binance). */
export function readGrossUsdCents(row: {
  amount_cents?: number;
  metadata?: unknown;
}): number | null {
  const metadata = row.metadata;
  if (isRecord(metadata)) {
    const charge = metadata.charge_currency;
    if (charge === "PEN") return null;
    const fromMeta = getNumber(metadata.gross_usd_cents);
    if (fromMeta !== null && fromMeta > 0) return Math.round(fromMeta);
  }

  const fromColumn = row.amount_cents;
  if (typeof fromColumn === "number" && fromColumn > 0) {
    return Math.round(fromColumn);
  }

  return null;
}
