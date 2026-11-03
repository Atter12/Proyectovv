/**
 * Deuda alineada al panel Crédito (Holistic).
 * Fuente única: r2 (centavos) + pagos dentro de su período o gasto vinculado.
 * Node: require("./credito-deuda-core"). Browser: window.HmCreditoDeudaCore.
 *
 * - Cobros con gasto_id imputan a la línea.
 * - Cobros solo con client_id: se agrupan por “mes en que cuenta” como el panel
 *   (Ql): periodo_resumen → gasto.mes (si hubiera gasto_id) → fecha (YYYY-MM);
 *   dentro de cada mes FIFO por línea; el sobrante del mes + montos en meses sin
 *   gastos quedan sin aplicar; no pasan a otro período.
 * - Garantías: registros históricos; no reducen la deuda.
 */

function r2(x) {
  return Math.round(Number(x || 0) * 100) / 100;
}

/** Gross receipt remains unchanged. Only an authenticated, exact payment
 * breakdown may exclude a gateway surcharge from settlement of base + FEE.
 * This browser-safe validation mirrors _creditoPaymentBreakdown's receipt
 * contract; parity tests keep the server and browser rules aligned. */
function paymentApplicableAmount(row) {
  var amount = Number((row && row.monto) || 0);
  var value = row && row.funding_breakdown;
  var gross = Math.round(amount * 100);
  var safeId = function (id) { return typeof id === "string" && id.length > 0 && id.length <= 200 && id.trim() === id && ["__proto__", "constructor", "prototype"].indexOf(id.toLowerCase()) < 0; };
  var money = function (n) { return Number.isSafeInteger(n) && n >= 0; };
  var match = /^AH-(STRIPE|BCP|YAPE|CRYPTO|WHOP)-(.+)$/.exec((row && row.codigo) || "");
  var providers = { STRIPE: "stripe", BCP: "manual", YAPE: "cobrana", CRYPTO: "crypto", WHOP: "whop" };
  if (!Number.isFinite(amount) || !money(gross) || !match || !value || typeof value !== "object" || Array.isArray(value)) return amount;
  if (value.schema_version !== 1 || value.currency !== "USD" || ["wallet_topup", "credit_debt", "unknown"].indexOf(value.mode) < 0) return amount;
  if (!safeId(value.payment_intent_id) || !safeId(value.hecom_client_id) || value.payment_intent_id !== match[2] || value.provider !== providers[match[1]] || String(value.hecom_client_id).toLowerCase() !== String(row.client_id).toLowerCase()) return amount;
  if (value.source !== null && !safeId(value.source) || value.ledger_journal_id !== null && !safeId(value.ledger_journal_id)) return amount;
  var keys = ["wallet_credit_cents", "holistic_fee_cents", "gateway_surcharge_cents", "unclassified_cents"];
  if (!money(value.gross_cents) || value.gross_cents === 0 || value.gross_cents !== gross || keys.some(function (key) { return !money(value[key]); })) return amount;
  if (keys.reduce(function (sum, key) { return sum + BigInt(value[key]); }, 0n) !== BigInt(gross)) return amount;
  if (value.mode !== "wallet_topup" && (value.wallet_credit_cents !== 0 || value.holistic_fee_cents !== 0)) return amount;
  if (value.mode === "unknown" && (value.gateway_surcharge_cents !== 0 || value.unclassified_cents !== gross)) return amount;
  if (["fee_holistic_percent", "fee_gateway_percent"].some(function (key) { var rate = value[key]; return rate !== null && (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 1000); })) return amount;
  return value.gateway_surcharge_cents > 0 ? (gross - value.gateway_surcharge_cents) / 100 : amount;
}

function lineTotalFromGastoRow(g) {
  var gasto = Number((g && g.gasto) || 0);
  var fee = Number((g && g.fee) || 0);
  return gasto + gasto * (fee / 100);
}

/**
 * Mes en que “cuenta” un cobro para el resumen (equivalente a Ql() en el bundle).
 */
function mesResumenCobroRow(c, gastoById) {
  var pr = c.periodo_resumen != null && String(c.periodo_resumen).trim();
  if (pr) return normMesResumen(c.periodo_resumen);
  var gid = c.gasto_id != null && String(c.gasto_id).trim() !== "" ? String(c.gasto_id) : "";
  if (gid && gastoById[gid]) {
    var gm = mesPeriodoFromGasto(gastoById[gid]);
    if (gm) return gm;
  }
  if (c.fecha != null && String(c.fecha).trim() !== "") return normMesResumen(String(c.fecha).slice(0, 10));
  return "";
}

/**
 * @param {Array<{id:any,mes?:any,gasto?:any,fee?:any}>} gastos - orden mes.asc, id.asc
 * @param {Array<{monto?:any,gasto_id?:any,client_id?:any,periodo_resumen?:any,fecha?:any}>} cobros
 * @param {string} clientId
 * @returns {{ byGastoId: Record<string, { line_total: number, pendiente: number, cobrado_line: number }>, poolRemaining: number }}
 */
function buildGastoSettlementByFifo(gastos, cobros, clientId) {
  var cid = String(clientId || "");
  var gastoById = buildGastoByIdMap(gastos);
  var cobrosByGasto = {};
  var poolByMes = {};
  if (Array.isArray(cobros)) {
    for (var ci = 0; ci < cobros.length; ci += 1) {
      var c = cobros[ci] || {};
      var gid = c.gasto_id != null && String(c.gasto_id).trim() !== "" ? String(c.gasto_id) : "";
      var monto = paymentApplicableAmount(c);
      if (!(monto > 0)) continue;
      if (gid) {
        cobrosByGasto[gid] = r2((cobrosByGasto[gid] || 0) + monto);
      } else if (cid && String(c.client_id || "") === cid) {
        var mk = mesResumenCobroRow(c, gastoById);
        if (!mk) mk = "sin_periodo";
        poolByMes[mk] = r2((poolByMes[mk] || 0) + monto);
      }
    }
  }

  var gastosArr = Array.isArray(gastos) ? gastos : [];
  var byMes = {};
  for (var gi = 0; gi < gastosArr.length; gi += 1) {
    var g0 = gastosArr[gi];
    if (!g0 || g0.id == null || String(g0.id).trim() === "") continue;
    var mesk0 = mesPeriodoFromGasto(g0) || "sin_periodo";
    if (!byMes[mesk0]) byMes[mesk0] = [];
    byMes[mesk0].push(String(g0.id));
  }

  var pendById = {};
  for (var gj = 0; gj < gastosArr.length; gj += 1) {
    var gg = gastosArr[gj];
    if (!gg || gg.id == null || String(gg.id).trim() === "") continue;
    var id0 = String(gg.id);
    var lt0 = r2(lineTotalFromGastoRow(gg));
    var explicit0 = r2(cobrosByGasto[id0] || 0);
    pendById[id0] = r2(Math.max(0, lt0 - explicit0));
  }

  var globalSpill = 0;
  var monthKeys = Object.keys(byMes).sort();
  for (var mi = 0; mi < monthKeys.length; mi += 1) {
    var mesM = monthKeys[mi];
    var poolRem = r2(poolByMes[mesM] || 0);
    if (poolRem <= 0.005) continue;
    var idList = byMes[mesM];
    for (var li = 0; li < idList.length && poolRem > 0.005; li += 1) {
      var gLine = idList[li];
      var pd = r2(pendById[gLine] || 0);
      if (pd <= 0.005) continue;
      var take = r2(Math.min(poolRem, pd));
      pendById[gLine] = r2(pd - take);
      poolRem = r2(poolRem - take);
    }
    if (poolRem > 0.005) globalSpill = r2(globalSpill + poolRem);
  }

  for (var pk in poolByMes) {
    if (!Object.prototype.hasOwnProperty.call(poolByMes, pk)) continue;
    if (!byMes[pk]) {
      globalSpill = r2(globalSpill + r2(poolByMes[pk] || 0));
    }
  }

  // 2026-11-03: no automatic cross-period coverage. Keep unused receipts
  // as unallocated evidence; never move/rewrite them or reduce another period.
  var poolRemG = r2(globalSpill);

  var byGastoId = {};
  for (var gyi = 0; gyi < gastosArr.length; gyi += 1) {
    var gy = gastosArr[gyi];
    if (!gy || gy.id == null || String(gy.id).trim() === "") continue;
    var idy = String(gy.id);
    var ltY = r2(lineTotalFromGastoRow(gy));
    var pend = r2(pendById[idy] || 0);
    byGastoId[idy] = {
      line_total: ltY,
      pendiente: pend,
      cobrado_line: r2(ltY - pend),
    };
  }
  return { byGastoId: byGastoId, poolRemaining: poolRemG };
}

function buildGastoByIdMap(gastos) {
  var m = {};
  if (!Array.isArray(gastos)) return m;
  for (var i = 0; i < gastos.length; i += 1) {
    var g = gastos[i];
    if (g && g.id != null && String(g.id).trim() !== "") m[String(g.id)] = g;
  }
  return m;
}

/** Misma normalización YYYY-MM que el panel para claves de período. */
function normMesResumen(raw) {
  if (raw == null) return "";
  var s = String(raw).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return s;
}

/**
 * Mes resumen de una fila garantías (PostgREST snake_case), equivalente a g0() en el bundle.
 */
function mesResumenGarantiaRow(g, gastoById) {
  var pr = g.periodo_resumen != null && String(g.periodo_resumen).trim();
  if (pr) return normMesResumen(pr);
  var gid = g.gasto_id != null && String(g.gasto_id).trim() !== "" ? String(g.gasto_id) : "";
  if (gid && gastoById[gid]) {
    var gm = mesPeriodoFromGasto(gastoById[gid]);
    if (gm) return gm;
  }
  var fc = g.fecha_colocacion != null ? String(g.fecha_colocacion).trim() : "";
  if (fc && /^\d{4}-\d{2}/.test(fc)) return normMesResumen(fc);
  if (g.created_at) return normMesResumen(String(g.created_at).slice(0, 10));
  return "";
}

function isGarantiaVigente(estado) {
  return (
    String(estado || "")
      .trim()
      .toLowerCase() === "vigente"
  );
}

/** Suma de crédito (valor) por clave de mes; solo estado Vigente. */
function buildGarantiaCreditByMes(garantias, gastoById) {
  var credit = {};
  if (!Array.isArray(garantias)) return credit;
  for (var i = 0; i < garantias.length; i += 1) {
    var row = garantias[i] || {};
    if (!isGarantiaVigente(row.estado)) continue;
    var v = r2(Number(row.valor || 0));
    if (!(v > 0.005)) continue;
    var mk = mesResumenGarantiaRow(row, gastoById);
    if (!mk) mk = "sin_periodo";
    credit[mk] = r2((credit[mk] || 0) + v);
  }
  return credit;
}

/**
 * Pendiente por gasto_id tras los cobros registrados, sin ajustes de garantías.
 */
function remPendienteByGastoAfterGarantias(gastos, settlement, garantias) {
  // Compatibility name for existing consumers. Guarantees are historical records,
  // not automatic payments against debt (owner instruction 2026-11-03).
  var rem = {};
  for (var i = 0; i < gastos.length; i += 1) {
    var g = gastos[i];
    if (!g || g.id == null) continue;
    var row = settlement.byGastoId[String(g.id)];
    rem[String(g.id)] = row ? r2(row.pendiente) : r2(Math.max(0, lineTotalFromGastoRow(g)));
  }
  return rem;
}

function sameClientId(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

/** Mes calendario del gasto: fecha_movimiento → columna mes (igual que Cobranza / ficha). */
function mesPeriodoFromGasto(g) {
  if (!g) return "";
  var fm =
    g.fecha_movimiento != null && String(g.fecha_movimiento).trim()
      ? String(g.fecha_movimiento).trim().slice(0, 10)
      : g.fechaMovimiento != null && String(g.fechaMovimiento).trim()
        ? String(g.fechaMovimiento).trim().slice(0, 10)
        : "";
  if (fm && /^\d{4}-\d{2}-\d{2}$/.test(fm)) return fm.slice(0, 7);
  return normMesResumen(g.mes) || "";
}

/** Misma regla que Cobranza (gastoBelongsToReporteMes): fecha_movimiento en el mes, si no → mes. */
function gastoBelongsToYm(g, ym) {
  if (!g || !ym || !/^\d{4}-\d{2}$/.test(ym)) return false;
  var fm =
    g.fecha_movimiento != null && String(g.fecha_movimiento).trim()
      ? String(g.fecha_movimiento).trim().slice(0, 10)
      : g.fechaMovimiento != null && String(g.fechaMovimiento).trim()
        ? String(g.fechaMovimiento).trim().slice(0, 10)
        : "";
  if (fm && /^\d{4}-\d{2}-\d{2}$/.test(fm)) {
    var mesStart = ym + "-01";
    var parts = ym.split("-");
    var lastDay = new Date(Number(parts[0]), Number(parts[1]), 0).getDate();
    var mesEnd = ym + "-" + String(lastDay).padStart(2, "0");
    return fm >= mesStart && fm <= mesEnd;
  }
  return normMesResumen(g.mes) === ym;
}

function filterGastosForYm(gastos, ym) {
  var list = Array.isArray(gastos) ? gastos : [];
  if (!ym) return list;
  var out = [];
  var i;
  for (i = 0; i < list.length; i += 1) {
    var g = list[i];
    if (!g) continue;
    if (gastoBelongsToYm(g, ym)) out.push(g);
  }
  return out;
}

function filterCobrosForYm(cobros, gastos, ym) {
  var list = Array.isArray(cobros) ? cobros : [];
  if (!ym) return list;
  var gastoById = buildGastoByIdMap(gastos);
  var out = [];
  var i;
  for (i = 0; i < list.length; i += 1) {
    var c = list[i] || {};
    if (mesResumenCobroRow(c, gastoById) === ym) out.push(c);
  }
  return out;
}

function filterGarantiasForYm(garantias, gastos, ym) {
  var list = Array.isArray(garantias) ? garantias : [];
  if (!ym) return list;
  var gastoById = buildGastoByIdMap(gastos);
  var out = [];
  var i;
  for (i = 0; i < list.length; i += 1) {
    var g = list[i] || {};
    if (mesResumenGarantiaRow(g, gastoById) === ym) out.push(g);
  }
  return out;
}

/**
 * Pendiente de un cliente: pagos del período, sin ajustes históricos automáticos.
 *
 * Se resuelve sobre todo el historial para respetar vínculos explícitos a gastos,
 * luego se filtra el mes. No se trasladan sobrantes entre períodos.
 */
function saldoPendienteCliente(gastos, cobros, garantias, clientId, ym) {
  var cid = String(clientId || "").trim().toLowerCase();
  if (!cid) return 0;
  var gsAll = Array.isArray(gastos) ? gastos : [];
  var gs = [];
  var i;
  for (i = 0; i < gsAll.length; i += 1) {
    if (gsAll[i] && sameClientId(gsAll[i].client_id, cid)) gs.push(gsAll[i]);
  }
  if (!gs.length) return 0;
  // Del mes más viejo al más nuevo: el orden define a qué línea entra primero
  // el pago dentro de su período.
  gs.sort(function (a, b) {
    var ma = mesPeriodoFromGasto(a) || "9999-99";
    var mb = mesPeriodoFromGasto(b) || "9999-99";
    if (ma !== mb) return ma < mb ? -1 : 1;
    return String(a.id) < String(b.id) ? -1 : 1;
  });
  var gastoOwner = {};
  for (i = 0; i < gs.length; i += 1) {
    if (gs[i] && gs[i].id != null) gastoOwner[String(gs[i].id)] = cid;
  }
  var cobAll = Array.isArray(cobros) ? cobros : [];
  var cos = [];
  for (i = 0; i < cobAll.length; i += 1) {
    var co = cobAll[i] || {};
    var ccid = String(co.client_id || "").trim().toLowerCase();
    if (!ccid && co.gasto_id) ccid = gastoOwner[String(co.gasto_id)] || "";
    if (ccid === cid) cos.push(co);
  }
  var garAll = Array.isArray(garantias) ? garantias : [];
  var gars = [];
  for (i = 0; i < garAll.length; i += 1) {
    if (garAll[i] && sameClientId(garAll[i].client_id, cid)) gars.push(garAll[i]);
  }
  var settlement = buildGastoSettlementByFifo(gs, cos, gs[0].client_id || cid);
  var rem = remPendienteByGastoAfterGarantias(gs, settlement, gars);
  var net = 0;
  for (i = 0; i < gs.length; i += 1) {
    if (ym && !gastoBelongsToYm(gs[i], ym)) continue;
    net = r2(net + Number(rem[String(gs[i].id)] || 0));
  }
  return net;
}

/** Totales ya agregados (KPI Resumen): r2(max(0, total − cobrado)). */
function saldoPendienteAgregado(total, cobrado, garantiasVigentes) {
  return r2(Math.max(0, Number(total || 0) - Number(cobrado || 0)));
}

/**
 * Mismo recorte que las tarjetas de ficha Crédito (mes):
 * TOTAL = r2(suma de gasto+fee en crudo); DEUDA NETA = TOTAL − cobros aplicados del período.
 * No redondear en cada fila (eso inflaba {{gasto}} / {{saldo}} de WhatsApp).
 */
function resumenMesCliente(gastos, cobros, garantias, clientId, ym) {
  var cid = String(clientId || "").trim().toLowerCase();
  var cargo = 0;
  var cobrado = 0;
  var cobradoAplicable = 0;
  var garSum = 0;
  var i;
  if (cid && ym) {
    var gs = filterGastosForYm(gastos, ym);
    for (i = 0; i < gs.length; i += 1) {
      if (!gs[i] || !sameClientId(gs[i].client_id, cid)) continue;
      cargo += lineTotalFromGastoRow(gs[i]);
    }
    var cobAll = filterCobrosForYm(cobros, gastos, ym);
    for (i = 0; i < cobAll.length; i += 1) {
      var co = cobAll[i] || {};
      var ccid = String(co.client_id || "").trim().toLowerCase();
      if (ccid !== cid) continue;
      cobrado += Number(co.monto || 0);
      cobradoAplicable += paymentApplicableAmount(co);
    }
    // Guarantees remain queryable, but are not applied to the collectible balance.

  }
  cargo = r2(cargo);
  cobrado = r2(cobrado);
  garSum = r2(garSum);
  // El saldo sale del mismo FIFO que la ficha, no de restar solo lo imputado al
  // mes: así {{saldo}} no reclama plata que el cliente ya cubrió con un pago o
  // una garantía de otro período. `cargo`, `cobrado` y `garantias` siguen
  // describiendo el mes en crudo, para mostrar.
  return {
    cargo: cargo,
    cobrado: cobrado,
    cobradoAplicable: r2(cobradoAplicable),
    garantias: garSum,
    saldo: cid && ym ? saldoPendienteCliente(gastos, cobros, garantias, cid, ym) : 0,
  };
}

/** client_id en minúsculas con saldo FIFO >= minSaldo (default $1). */
function idsConSaldo(clientes, gastos, cobros, garantias, ym, minSaldo) {
  var min = minSaldo == null ? 1 : Number(minSaldo);
  var list = Array.isArray(clientes) ? clientes : [];
  var ids = [];
  var i;
  for (i = 0; i < list.length; i += 1) {
    var cl = list[i];
    if (!cl || cl.id == null) continue;
    var id = String(cl.id).trim().toLowerCase();
    if (!id) continue;
    var net = saldoPendienteCliente(gastos, cobros, garantias, id, ym || "");
    if (net >= min) ids.push(id);
  }
  return ids;
}

var HmCreditoDeudaCore = {
  r2: r2,
  lineTotalFromGastoRow: lineTotalFromGastoRow,
  paymentApplicableAmount: paymentApplicableAmount,
  buildGastoSettlementByFifo: buildGastoSettlementByFifo,
  normMesResumen: normMesResumen,
  mesPeriodoFromGasto: mesPeriodoFromGasto,
  gastoBelongsToYm: gastoBelongsToYm,
  remPendienteByGastoAfterGarantias: remPendienteByGastoAfterGarantias,
  saldoPendienteCliente: saldoPendienteCliente,
  saldoPendienteAgregado: saldoPendienteAgregado,
  resumenMesCliente: resumenMesCliente,
  idsConSaldo: idsConSaldo,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = HmCreditoDeudaCore;
}
if (typeof window !== "undefined") {
  window.HmCreditoDeudaCore = HmCreditoDeudaCore;
}
