import { shiftYmd } from "@/lib/hecom/gasto-date";

/**
 * Cuánto debe el cliente en un mes, con la misma regla que el estado de cuenta
 * del link de deuda (VoucherAccountStatement): gasto + fee del mes (el mes actual
 * hasta ayer) menos lo cobrado imputable a ese mes (por periodo_resumen; si no
 * tiene, por fecha de pago). Positivo = debe.
 */
export function monthOwedUsd(input: {
  monthYm: string;
  todayYmd: string;
  feePercent: number;
  gastos: Array<{ fecha: string | null; gasto: number; fee: number | null }>;
  cobros: Array<{ fecha: string | null; monto: number; applicableMonto?: number | null; periodoResumen?: string | null }>;
}): number {
  const { monthYm, todayYmd } = input;
  const [y, m] = monthYm.split("-").map(Number);
  if (!y || !m) return 0;
  const from = `${monthYm}-01`;
  const monthLast = `${monthYm}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const isCurrent = todayYmd.slice(0, 7) === monthYm;
  const yesterday = shiftYmd(todayYmd, -1);
  const spendTo = isCurrent ? (yesterday < from ? from : yesterday) : monthLast;
  const paidTo = isCurrent ? todayYmd : monthLast;
  const day = (v: string | null) => (v ? v.trim().slice(0, 10) : "");

  let gasto = 0;
  let fee = 0;
  for (const g of input.gastos) {
    const d = day(g.fecha);
    if (!d || d < from || d > spendTo) continue;
    const pct = g.fee != null && Number.isFinite(g.fee) ? g.fee : input.feePercent;
    gasto += g.gasto;
    if (pct > 0 && g.gasto > 0) fee += g.gasto * (pct / 100);
  }
  let paid = 0;
  for (const c of input.cobros) {
    const periodo = c.periodoResumen?.trim().slice(0, 7) || null;
    const d = day(c.fecha);
    const inMonth = periodo ? periodo === monthYm : Boolean(d) && d >= from && d <= paidTo;
    if (!inMonth) continue;
    paid += c.applicableMonto != null && Number.isFinite(c.applicableMonto) ? c.applicableMonto : c.monto;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return r2(r2(gasto) + r2(fee) - r2(paid));
}
