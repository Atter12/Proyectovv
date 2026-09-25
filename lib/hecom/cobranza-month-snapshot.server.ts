import "server-only";

import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import {
  buildCobranzaMonthSnapshot,
  type CobranzaMonthSnapshot,
} from "@/lib/hecom/cobranza-month-snapshot";

export type { CobranzaMonthSnapshot };
export { buildCobranzaMonthSnapshot };

export type WaCobranzaSnapshotResult = CobranzaMonthSnapshot & {
  hecomClienteId: string;
  nombre: string;
  currency: "USD";
  feePercent: number;
  source: string;
  skipCobranza: boolean;
};

/**
 * Carga dashboard Hecom (misma fuente que Cuánto debes) y arma el snapshot.
 */
export async function loadWaCobranzaSnapshot(input: {
  hecomClienteId: string;
  monthYm: string;
  corteYmd?: string | null;
}): Promise<WaCobranzaSnapshotResult | null> {
  const dashboard = await getHecomClienteDashboard(input.hecomClienteId, {
    fullFinance: true,
    includeCampaignSpend: false,
    includeCreativos: false,
    includeDailySpend: false,
  });
  if (!dashboard) return null;

  const snap = buildCobranzaMonthSnapshot({
    gastos: dashboard.gastos.map((row) => ({
      fecha: row.fecha,
      gasto: row.gasto,
      fee: row.fee,
      camp: row.camp,
    })),
    cobros: dashboard.cobros.map((row) => ({
      fecha: row.fecha,
      monto: row.monto,
      applicableMonto: row.applicableMonto,
      metodo: row.metodo,
      periodoResumen: row.periodoResumen,
      notas: row.notas,
    })),
    feePercent: dashboard.summary.depositFeePercent,
    monthYm: input.monthYm,
    corteYmd: input.corteYmd,
  });

  return {
    ...snap,
    hecomClienteId: dashboard.cliente.id,
    nombre: dashboard.cliente.name,
    currency: "USD",
    feePercent: dashboard.summary.depositFeePercent,
    source: dashboard.source,
    skipCobranza: snap.deudaCorte <= 0,
  };
}
