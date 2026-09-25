/**
 * E2E local: snapshot WA vs KPIs Cuánto debes (solo lectura).
 * Uso: npx tsx --env-file=.env.local scripts/e2e-wa-cobranza-snapshot.mts [clienteId] [ym] [corte]
 */
import { loadWaCobranzaSnapshot } from "@/lib/hecom/cobranza-month-snapshot.server";

const clienteId = process.argv[2] || "CL-IKSNIR71";
const monthYm = process.argv[3] || "2026-09";
const corteYmd = process.argv[4] || null;

const snap = await loadWaCobranzaSnapshot({
  hecomClienteId: clienteId,
  monthYm,
  corteYmd,
});

if (!snap) {
  console.error("Cliente no encontrado:", clienteId);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      id: snap.hecomClienteId,
      nombre_len: snap.nombre.length,
      periodo_ym: snap.monthYm,
      corte: snap.spendTo,
      gasto: snap.gasto,
      fee: snap.fee,
      cargo: snap.cargo,
      cobrado: snap.cobrado,
      del_mes: snap.delMes,
      deuda_corte: snap.deudaCorte,
      skip_cobranza: snap.skipCobranza,
      cobros_n: snap.cobros.length,
      peak: snap.peakCargo.key,
      source: snap.source,
    },
    null,
    2,
  ),
);
