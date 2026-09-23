import { createAdminClient } from "@/lib/supabase/admin";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";

/** Admin client — misma Postgres que Real Profit (`rp_*`). */
export function getRealProfitAdmin() {
  return createAdminClient();
}

/**
 * Rango default Profit: el jale de gasto Hecom cierra hasta el día anterior
 * (America/Lima), así que `to` nunca es “hoy”.
 */
export function profitSpendMaxYmd(
  timeZone = "America/Lima",
): string {
  return shiftYmd(todayYmdInTz(timeZone), -1);
}

export function defaultProfitDateRange(): { from: string; to: string } {
  const to = profitSpendMaxYmd();
  const from = shiftYmd(to, -29);
  return { from, to };
}

/** Clampa un rango para que no pase del último día jalado. */
export function clampProfitDateRange(input: {
  from: string;
  to: string;
}): { from: string; to: string } {
  const max = profitSpendMaxYmd();
  let from = input.from.trim();
  let to = input.to.trim();
  if (to && to > max) to = max;
  if (from && from > max) from = max;
  if (from && to && from > to) from = to;
  return { from, to };
}
