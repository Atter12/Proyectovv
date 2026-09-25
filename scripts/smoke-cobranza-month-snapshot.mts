import assert from "node:assert/strict";
import { buildCobranzaMonthSnapshot } from "@/lib/hecom/cobranza-month-snapshot";

/** Smoke: KPIs Cuánto debes con corte + periodo_resumen. */
function main() {
  const snap = buildCobranzaMonthSnapshot({
    todayYmd: "2026-09-24",
    monthYm: "2026-09",
    corteYmd: "2026-09-20",
    feePercent: 10,
    gastos: [
      { fecha: "2026-09-03", gasto: 100, fee: 10, camp: "A" },
      { fecha: "2026-09-15", gasto: 50, fee: null, camp: "B" },
      { fecha: "2026-09-22", gasto: 999, fee: 10, camp: "late" },
    ],
    cobros: [
      {
        fecha: "2026-09-09",
        monto: 66,
        applicableMonto: 66,
        metodo: "BCP",
        periodoResumen: "2026-09",
      },
      {
        fecha: "2026-09-01",
        monto: 103,
        applicableMonto: 100,
        metodo: "Stripe",
        periodoResumen: "2026-09",
        notas: "AH-STRIPE surcharge",
      },
    ],
  });

  assert.equal(snap.spendTo, "2026-09-20");
  assert.equal(snap.gasto, 150);
  assert.equal(snap.fee, 15); // 10 + 5 (10% de 50)
  assert.equal(snap.cargo, 165);
  assert.equal(snap.cobrado, 166);
  assert.equal(snap.deudaCorte, 0);
  assert.equal(snap.rangeSaldo, 1);
  console.log("cobranza-month-snapshot ok", {
    cargo: snap.cargo,
    cobrado: snap.cobrado,
    deudaCorte: snap.deudaCorte,
  });
}

main();
