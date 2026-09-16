/**
 * ¿A algún cliente le figura como deuda un mes que ya pagó? SOLO LECTURA.
 *
 * El CRM arma cada mes con dos fuentes distintas:
 *   deuda   = gastos del mes      (gasto * (1 + fee/100), agrupado por gastos.mes)
 *   cobrado = cobros del período  (agrupado por cobros.periodo_resumen)
 *
 * Si un pago queda archivado en un mes distinto al de la deuda que cubre, el mes
 * de la deuda aparece pendiente y el otro con saldo a favor. La plata está, pero
 * el CRM la muestra en otro cajón — y ahí es donde se le puede pedir dos veces.
 * Eso es lo que este script busca.
 *
 * Usage: node scripts/audit-hecom-saldos.mjs [--cliente "nombre"]
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const argv = process.argv.slice(2);
const soloCliente =
  argv.includes("--cliente") ? argv[argv.indexOf("--cliente") + 1] : null;

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  env[t.slice(0, i).trim()] = v;
}

const hecom = createClient(
  env.HECOM_SUPABASE_URL,
  env.HECOM_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function all(table, select) {
  const out = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await hecom
      .from(table)
      .select(select)
      .range(f, f + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}

const n = (v) => Number(v ?? 0);
const usd = (v) => `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
const CENTAVOS = 1; // menos de $1 es redondeo, no un problema

const gastos = await all("gastos", "id, client_id, mes, gasto, fee");
const cobros = await all(
  "cobros",
  "id, gasto_id, client_id, monto, fecha, periodo_resumen, codigo",
);
const clientes = await all("clientes", "id, name");
const nom = new Map(clientes.map((c) => [c.id, c.name]));
const gastoById = new Map(gastos.map((g) => [g.id, g]));

/** Deuda del gasto: el fee es un porcentaje sobre el gasto de ads. */
const deudaDe = (g) => n(g.gasto) * (1 + n(g.fee) / 100);

/**
 * Hasta junio de 2026 el cobro se ataba al gasto (`gasto_id`) y no al cliente,
 * y sin `periodo_resumen`. Son 142 cobros por ~$130k: si se leen solo por
 * `client_id` y por período, no los cuenta nadie y esos 23 clientes aparecen
 * debiendo plata que ya pagaron. Se resuelven por el gasto que pagaban.
 */
function ubicarCobro(c) {
  if (c.client_id) {
    return { clientId: c.client_id, periodo: c.periodo_resumen, legacy: false };
  }
  const g = c.gasto_id ? gastoById.get(c.gasto_id) : null;
  if (!g) return { clientId: null, periodo: c.periodo_resumen, legacy: true };
  return {
    clientId: g.client_id,
    periodo: c.periodo_resumen ?? g.mes,
    legacy: true,
  };
}

// ------------------------------------------- armado por cliente y por mes
const porCliente = new Map();
function cli(id) {
  if (!porCliente.has(id)) {
    porCliente.set(id, { meses: new Map(), sinPeriodo: 0, legacy: 0 });
  }
  return porCliente.get(id);
}
function mes(id, m) {
  const c = cli(id);
  if (!c.meses.has(m)) c.meses.set(m, { deuda: 0, cobrado: 0, cobros: [] });
  return c.meses.get(m);
}

for (const g of gastos) {
  if (!g.client_id || !g.mes) continue;
  mes(g.client_id, g.mes).deuda += deudaDe(g);
}
let huerfanos = 0;
for (const c of cobros) {
  const { clientId, periodo, legacy } = ubicarCobro(c);
  if (!clientId) {
    huerfanos += n(c.monto);
    continue;
  }
  if (legacy) cli(clientId).legacy += n(c.monto);
  if (!periodo) {
    cli(clientId).sinPeriodo += n(c.monto);
    continue;
  }
  const m = mes(clientId, periodo);
  m.cobrado += n(c.monto);
  m.cobros.push(c);
}

console.log("Saldos por cliente y mes en Hecom (solo lectura)");
console.log(`Fecha: ${new Date().toISOString()}\n`);

// ------------------------------------------------------------- 1. global
let gDeuda = 0;
let gCobrado = 0;
for (const [, c] of porCliente) {
  for (const [, m] of c.meses) {
    gDeuda += m.deuda;
    gCobrado += m.cobrado;
  }
}
const gLegacy = [...porCliente.values()].reduce((a, c) => a + c.legacy, 0);
console.log("=== 1. Global ===");
console.log(`deuda total (gastos + fee): ${usd(gDeuda)}`);
console.log(`cobrado total:              ${usd(gCobrado)}`);
console.log(`pendiente global:           ${usd(gDeuda - gCobrado)}`);
console.log(
  `\nde lo cobrado, ${usd(gLegacy)} son cobros del modelo viejo (atados al gasto, sin client_id).`,
);
if (huerfanos > CENTAVOS) {
  console.log(`${usd(huerfanos)} en cobros que no se pudieron atribuir a nadie.`);
}

// -------------------------------- 2. el caso que importa: deuda fantasma
// Un mes pendiente en un cliente que en el neto no debe nada: la plata ya
// entró, está archivada en otro mes.
console.log("\n=== 2. Clientes con un mes pendiente que YA tienen pagado ===");
const fantasmas = [];
const deudaReal = [];

for (const [id, c] of porCliente) {
  if (soloCliente && !(nom.get(id) ?? "").toLowerCase().includes(soloCliente.toLowerCase())) {
    continue;
  }
  let deuda = 0;
  let cobrado = 0;
  for (const [, m] of c.meses) {
    deuda += m.deuda;
    cobrado += m.cobrado;
  }
  cobrado += c.sinPeriodo;
  const neto = cobrado - deuda; // > 0 => pagó todo y le sobra
  const pendientes = [...c.meses.entries()]
    .filter(([, m]) => m.deuda - m.cobrado > CENTAVOS)
    .map(([m, v]) => ({ mes: m, falta: v.deuda - v.cobrado }))
    .sort((a, b) => (a.mes < b.mes ? -1 : 1));
  const aFavor = [...c.meses.entries()]
    .filter(([, m]) => m.cobrado - m.deuda > CENTAVOS)
    .map(([m, v]) => ({ mes: m, sobra: v.cobrado - v.deuda }))
    .sort((a, b) => (a.mes < b.mes ? -1 : 1));

  if (!pendientes.length) continue;

  const registro = { id, nombre: nom.get(id) ?? id, deuda, cobrado, neto, pendientes, aFavor, sinPeriodo: c.sinPeriodo };
  // Si en el neto no debe (o debe menos de lo que muestra un mes suelto),
  // el pendiente de ese mes es de archivo, no de plata.
  if (neto > -CENTAVOS) fantasmas.push(registro);
  else deudaReal.push(registro);
}

if (!fantasmas.length) {
  console.log("Ninguno. Todo mes pendiente corresponde a deuda real.");
} else {
  console.log(
    `${fantasmas.length} cliente(s). A estos NO hay que pedirles el mes pendiente: la plata ya entró.\n`,
  );
  for (const f of fantasmas.sort((a, b) => b.neto - a.neto)) {
    const totalFantasma = f.pendientes.reduce((a, b) => a + b.falta, 0);
    console.log(`${f.nombre}`);
    console.log(
      `   neto: pagó ${usd(f.cobrado)} sobre una deuda de ${usd(f.deuda)} -> ${f.neto >= 0 ? "a favor " + usd(f.neto) : "debe " + usd(-f.neto)}`,
    );
    console.log(
      `   muestra pendiente: ${f.pendientes.map((p) => `${p.mes} ${usd(p.falta)}`).join(" · ")}  (total ${usd(totalFantasma)})`,
    );
    if (f.aFavor.length) {
      console.log(
        `   y a favor en:      ${f.aFavor.map((p) => `${p.mes} ${usd(p.sobra)}`).join(" · ")}`,
      );
    }
    if (f.sinPeriodo > CENTAVOS) {
      console.log(`   ${usd(f.sinPeriodo)} en cobros SIN período (invisibles por mes)`);
    }
  }
}

// ------------------------------------------------------- 3. deuda real
console.log("\n=== 3. Clientes con deuda real (el neto no alcanza) ===");
console.log(`${deudaReal.length} cliente(s)`);
const top = deudaReal.sort((a, b) => a.neto - b.neto).slice(0, 15);
for (const d of top) {
  console.log(
    `  ${d.nombre}: debe ${usd(-d.neto)} | deuda ${usd(d.deuda)} · pagado ${usd(d.cobrado)} | meses: ${d.pendientes.map((p) => p.mes).join(", ")}`,
  );
}
if (deudaReal.length > top.length) {
  console.log(`  ... y ${deudaReal.length - top.length} más`);
}

// --------------------------- 4. cobros sin período (invisibles por mes)
const sinPeriodoTotal = [...porCliente.values()].reduce(
  (a, c) => a + c.sinPeriodo,
  0,
);
const conSinPeriodo = [...porCliente.entries()].filter(
  ([, c]) => c.sinPeriodo > CENTAVOS,
);
console.log("\n=== 4. Cobros sin período ===");
console.log(
  `${cobros.filter((c) => !c.periodo_resumen).length} cobros por ${usd(sinPeriodoTotal)} en ${conSinPeriodo.length} clientes`,
);
console.log(
  "No salen en ninguna vista filtrada por mes: el cliente los pagó pero el mes no los cuenta.",
);
for (const [id, c] of conSinPeriodo.sort((a, b) => b[1].sinPeriodo - a[1].sinPeriodo).slice(0, 10)) {
  console.log(`  ${nom.get(id) ?? id}: ${usd(c.sinPeriodo)}`);
}

// ------------------------------------ 5. períodos imposibles (tipeo)
console.log("\n=== 5. Cobros archivados en un mes que todavía no llegó ===");
const hoyMes = new Date().toISOString().slice(0, 7);
const futuros = cobros.filter(
  (c) => c.periodo_resumen && c.periodo_resumen > hoyMes,
);
if (!futuros.length) {
  console.log("Ninguno.");
} else {
  console.log(
    `${futuros.length}. Un período futuro es siempre un error de tipeo, y deja el mes real pendiente:`,
  );
  for (const c of futuros) {
    const g = c.gasto_id ? gastoById.get(c.gasto_id) : null;
    const quien = nom.get(c.client_id ?? g?.client_id) ?? "(sin cliente)";
    console.log(
      `  ${quien} | ${usd(n(c.monto))} | pagado ${c.fecha} | período ${c.periodo_resumen} | ${c.codigo}`,
    );
  }
}

// ---------------------------------------------- 6. detalle de un cliente
if (soloCliente) {
  console.log(`\n=== 6. Detalle mes por mes: ${soloCliente} ===`);
  for (const [id, c] of porCliente) {
    if (!(nom.get(id) ?? "").toLowerCase().includes(soloCliente.toLowerCase())) continue;
    console.log(`\n${nom.get(id)}`);
    for (const [m, v] of [...c.meses.entries()].sort()) {
      const saldo = v.cobrado - v.deuda;
      const auto = v.cobros.filter((x) => x.codigo?.startsWith("AH-")).length;
      console.log(
        `  ${m}: deuda ${usd(v.deuda).padStart(11)} · cobrado ${usd(v.cobrado).padStart(11)} · saldo ${usd(saldo).padStart(11)}  (${v.cobros.length} cobros, ${auto} automáticos)`,
      );
    }
    if (c.sinPeriodo) console.log(`  sin período: ${usd(c.sinPeriodo)}`);
  }
}

console.log("\n================ CIERRE ================");
console.log(
  fantasmas.length === 0
    ? ">>> Nadie tiene un mes pendiente que ya haya pagado."
    : `${fantasmas.length} cliente(s) muestran pendiente un mes que ya pagaron. Revisar arriba antes de cobrarles.`,
);
console.log("\n(solo lectura: no se modificó nada)");
