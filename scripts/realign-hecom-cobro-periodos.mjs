/**
 * Re-archiva los cobros automáticos (AH-*) al mes de su fecha de pago.
 *
 * Hecom imputa el cobro al período más viejo que el cliente tiene sin cubrir,
 * así que un pago de setiembre de un cliente con deuda de agosto queda
 * archivado en agosto. Como el CRM filtra por período y no por fecha de pago,
 * el pago parece no haberse registrado. Gerencia pidió que viva en el mes en
 * que se pagó.
 *
 * Solo toca cobros con codigo AH-* (los que crea la integración). Los que carga
 * el equipo a mano no se tocan nunca.
 *
 * Usage:
 *   node scripts/realign-hecom-cobro-periodos.mjs --dry-run
 *   node scripts/realign-hecom-cobro-periodos.mjs --commit
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const doCommit = args.has("--commit");

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

// Paginado: el default de PostgREST corta en 1000 y deja cobros afuera.
const cobros = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await hecom
    .from("cobros")
    .select("id, codigo, monto, fecha, metodo, client_id, periodo_resumen")
    .range(from, from + 999);
  if (error) throw new Error(error.message);
  cobros.push(...(data ?? []));
  if ((data?.length ?? 0) < 1000) break;
}

const { data: clientes } = await hecom.from("clientes").select("id, name");
const nombre = new Map((clientes ?? []).map((c) => [c.id, c.name]));

const automaticos = cobros.filter((c) => c.codigo?.startsWith("AH-"));
const desalineados = automaticos.filter((c) => {
  if (!c.fecha) return false;
  const mesPago = String(c.fecha).slice(0, 7);
  return c.periodo_resumen && c.periodo_resumen !== mesPago;
});

console.log(
  `Mode: ${doCommit ? "COMMIT" : "DRY-RUN"} | cobros=${cobros.length} | automaticos=${automaticos.length} | a re-archivar=${desalineados.length}\n`,
);

if (!desalineados.length) {
  console.log("Nada que mover: todos los automaticos ya estan en su mes de pago.");
  process.exit(0);
}

// Impacto por cliente y mes, para ver qué totales se mueven.
const delta = {};
for (const c of desalineados) {
  const mesPago = String(c.fecha).slice(0, 7);
  const monto = Number(c.monto ?? 0);
  const who = nombre.get(c.client_id) ?? c.client_id;
  delta[who] = delta[who] ?? {};
  delta[who][c.periodo_resumen] = (delta[who][c.periodo_resumen] ?? 0) - monto;
  delta[who][mesPago] = (delta[who][mesPago] ?? 0) + monto;
}

console.log("=== Detalle ===");
for (const c of desalineados.sort((a, b) => (a.fecha < b.fecha ? -1 : 1))) {
  const mesPago = String(c.fecha).slice(0, 7);
  console.log(
    `${nombre.get(c.client_id) ?? c.client_id} | $${c.monto} | pago ${c.fecha} | ${c.periodo_resumen} -> ${mesPago}`,
  );
}

console.log("\n=== Impacto en el cobrado por mes ===");
for (const [who, meses] of Object.entries(delta)) {
  const partes = Object.entries(meses)
    .sort()
    .map(([m, v]) => `${m}: ${v > 0 ? "+" : ""}$${v.toFixed(2)}`);
  console.log(`${who} -> ${partes.join(" | ")}`);
}

if (!doCommit) {
  console.log("\nDRY-RUN: no se escribio nada. Corre con --commit para aplicar.");
  process.exit(0);
}

let ok = 0;
let fail = 0;
for (const c of desalineados) {
  const mesPago = String(c.fecha).slice(0, 7);
  const { error } = await hecom
    .from("cobros")
    .update({ periodo_resumen: mesPago })
    .eq("id", c.id)
    .eq("periodo_resumen", c.periodo_resumen); // no pisar si cambio mientras corria
  if (error) {
    fail += 1;
    console.error(`FAIL ${c.codigo}: ${error.message}`);
  } else {
    ok += 1;
  }
}

console.log(`\nDone: movidos=${ok} fallidos=${fail}`);

// Verificación
const verif = [];
for (let from = 0; ; from += 1000) {
  const { data } = await hecom
    .from("cobros")
    .select("codigo, fecha, periodo_resumen")
    .range(from, from + 999);
  verif.push(...(data ?? []));
  if ((data?.length ?? 0) < 1000) break;
}
const restantes = verif.filter(
  (c) =>
    c.codigo?.startsWith("AH-") &&
    c.fecha &&
    c.periodo_resumen &&
    c.periodo_resumen !== String(c.fecha).slice(0, 7),
);
console.log(
  restantes.length
    ? `REVISAR: quedan ${restantes.length} desalineados`
    : ">>> VERIFICADO: todos los cobros automaticos estan en su mes de pago",
);
if (fail) process.exit(2);
