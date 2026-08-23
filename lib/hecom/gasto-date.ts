import type { HecomGastoRow } from "@/lib/hecom/cliente-finance.types";

export function gastoDateKey(row: HecomGastoRow): string | null {
  return row.fecha?.trim() || null;
}

export function sortGastosByDateDesc(gastos: HecomGastoRow[]): HecomGastoRow[] {
  return [...gastos].sort((a, b) => {
    const da = gastoDateKey(a) ?? "";
    const db = gastoDateKey(b) ?? "";
    if (da !== db) return db.localeCompare(da);
    return b.id.localeCompare(a.id);
  });
}

export function filterGastosByDateRange(
  gastos: HecomGastoRow[],
  startDate: string,
  endDate: string,
): HecomGastoRow[] {
  const start = startDate <= endDate ? startDate : endDate;
  const end = startDate <= endDate ? endDate : startDate;
  return gastos.filter((row) => {
    const date = gastoDateKey(row);
    if (!date) return false;
    return date >= start && date <= end;
  });
}

export function getGastosDateBounds(gastos: HecomGastoRow[]): {
  min: string | null;
  max: string | null;
} {
  let min: string | null = null;
  let max: string | null = null;
  for (const row of gastos) {
    const date = gastoDateKey(row);
    if (!date) continue;
    if (!min || date < min) min = date;
    if (!max || date > max) max = date;
  }
  return { min, max };
}

export function shiftYmd(dateYmd: string, deltaDays: number): string {
  const base = new Date(`${dateYmd}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

export function todayYmdInTz(timeZone = "America/Lima"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
