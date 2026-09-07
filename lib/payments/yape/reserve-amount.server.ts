import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { getNumber, isRecord } from "@/lib/records";

/**
 * Céntimos únicos en el monto a pagar. APAGADO por defecto.
 *
 * El identificador natural de un pago es el N° de operación, y lo tenemos de
 * los dos lados: el análisis del comprobante lo guarda en
 * `voucher_operation_code` y el aviso del banco lo trae en el texto. Mientras
 * el canal de avisos incluya ese número, el cruce es exacto y no hace falta
 * tocar el monto.
 *
 * Esto es el respaldo para cuando el aviso NO trae N° de operación — el caso
 * típico de una notificación push de Android, que solo dice quién y cuánto.
 * Ahí el monto es lo único que separa una recarga de otra, y dos clientes que
 * piden $30 recibirían los dos S/ 114.84.
 *
 * Se enciende con `YAPE_UNIQUE_PEN_CENTS=true`. El costo es que el cliente
 * paga hasta S/ 0.99 de más; el crédito en cartera no cambia.
 */

/** Cuántos ajustes probamos antes de rendirnos. */
const MAX_ATTEMPTS = 100;

/** Ventana en la que un monto sigue reservado. Coincide con la de cruce. */
function getWindowMinutes(): number {
  return serverEnv.yapeMatchWindowMinutes ?? 180;
}

export class AmountReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmountReservationError";
  }
}

/**
 * Devuelve un monto en céntimos de sol que no colisiona con ningún pago
 * manual PEN abierto.
 */
export async function reserveUniquePenAmount(
  grossPenCents: number,
): Promise<{ amountCents: number; discriminatorCents: number }> {
  if (!serverEnv.yapeUniquePenCents) {
    return { amountCents: grossPenCents, discriminatorCents: 0 };
  }

  const taken = await getOpenPenAmounts();

  let discriminatorCents = 0;
  while (
    discriminatorCents < MAX_ATTEMPTS &&
    taken.has(grossPenCents + discriminatorCents)
  ) {
    discriminatorCents += 1;
  }

  if (discriminatorCents >= MAX_ATTEMPTS) {
    // Cien recargas abiertas por el mismo monto exacto. Antes que entregar un
    // monto ambiguo — que después nadie puede cruzar solo — preferimos fallar.
    throw new AmountReservationError(
      "Hay demasiadas recargas abiertas por este monto. Probá de nuevo en unos minutos o cambiá el monto.",
    );
  }

  return { amountCents: grossPenCents + discriminatorCents, discriminatorCents };
}

/**
 * Montos en soles ya comprometidos por pagos manuales vivos.
 *
 * Vencida la ventana el monto vuelve al pool: un pago muy tardío queda sin
 * cruzar y lo resuelve un humano, que es preferible a cruzarlo con la recarga
 * de otra persona.
 */
async function getOpenPenAmounts(): Promise<Set<number>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select("amount_cents, metadata")
    .eq("provider", "manual")
    .eq("currency", "PEN")
    .in("status", ["created", "requires_payment", "processing"])
    .gte(
      "created_at",
      new Date(Date.now() - getWindowMinutes() * 60_000).toISOString(),
    );

  if (error) throw new AmountReservationError(error.message);

  const reserved = new Set<number>();
  for (const row of data ?? []) {
    const amount = readGrossPenCents(row as { amount_cents?: number; metadata?: unknown });
    if (amount !== null) reserved.add(amount);
  }
  return reserved;
}

/**
 * Bruto en soles de un intent.
 *
 * En los pagos manuales PEN, `amount_cents` ya está en céntimos de sol y
 * `metadata.gross_pen_cents` guarda lo mismo. Leemos el metadata primero y
 * caemos a la columna, que es lo que el cliente realmente tiene que pagar.
 */
export function readGrossPenCents(row: {
  amount_cents?: number;
  metadata?: unknown;
}): number | null {
  const metadata = row.metadata;
  if (isRecord(metadata)) {
    if (metadata.charge_currency !== "PEN") return null;
    const fromMeta = getNumber(metadata.gross_pen_cents);
    if (fromMeta !== null && fromMeta > 0) return Math.round(fromMeta);
  }

  const fromColumn = row.amount_cents;
  if (typeof fromColumn === "number" && fromColumn > 0) return Math.round(fromColumn);

  return null;
}
