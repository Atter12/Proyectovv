import core from "./debt-core.cjs";

export type MonthlyDebtSettlement = Record<string, {
  pending: number;
  cargo: number;
  covered: number;
}>;

/** Same read-only FIFO as Hecom. Receipt dates, amounts and periods stay intact. */
export function calculateMonthlyDebtSettlement(
  clientId: string,
  gastos: Record<string, unknown>[],
  cobros: Record<string, unknown>[],
  garantias: Record<string, unknown>[],
): MonthlyDebtSettlement {
  if (!clientId || gastos.some(g => g.client_id !== clientId) || garantias.some(g => g.client_id !== clientId)) {
    throw new Error("Settlement data belongs to another customer");
  }
  const gastoIds = new Set(gastos.map(g => String(g.id)));
  if (cobros.some(c => c.client_id !== clientId && !(c.client_id == null && gastoIds.has(String(c.gasto_id))))) {
    throw new Error("Settlement receipt belongs to another customer");
  }
  const grouped = new Map<string, { ads: number; fee: number }>();
  for (const gasto of gastos) {
    const ym = core.mesPeriodoFromGasto(gasto);
    if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error("Settlement expense has no valid period");
    const row = grouped.get(ym) ?? { ads: 0, fee: 0 };
    const ads = Number(gasto.gasto || 0), fee = Number(gasto.fee || 0);
    if (!Number.isFinite(ads) || !Number.isFinite(fee)) throw new Error("Invalid settlement amount");
    row.ads += ads;
    row.fee += ads * fee / 100;
    grouped.set(ym, row);
  }
  const result: MonthlyDebtSettlement = {};
  for (const [ym, row] of grouped) {
    const cargo = core.r2(core.r2(row.ads) + core.r2(row.fee));
    const pending = core.saldoPendienteCliente(gastos, cobros, garantias, clientId, ym);
    if (!Number.isFinite(pending) || pending < 0) throw new Error("Invalid settlement result");
    result[ym] = { pending, cargo, covered: core.r2(Math.max(0, cargo - pending)) };
  }
  return result;
}
