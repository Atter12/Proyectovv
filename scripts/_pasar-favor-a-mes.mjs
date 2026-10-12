// Pasa saldo a favor de un mes a otro en Hecom moviendo cobros (enteros primero, y parte de
// uno si hace falta), con la misma lógica del cron de arrastre (respeta el recargo de pasarela).
// Caso: Wilder Remolina, 12/10/2026 (favor de octubre a la deuda de setiembre).
//   node --use-system-ca --env-file=.env.local scripts/_pasar-favor-a-mes.mjs <clienteId> <desde YYYY-MM> <hacia YYYY-MM> <monto> [--commit]
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const arrastre = require("C:/Users/Public/Documents/trabajos holistic/hecom.club/hecom-club/api/_saldoArrastre.js");
const [ID, FROM, TO, MONTO] = process.argv.slice(2);
const COMMIT = process.argv.includes("--commit");
if (!ID || !/^\d{4}-\d{2}$/.test(FROM || "") || !/^\d{4}-\d{2}$/.test(TO || "") || !(Number(MONTO) > 0)) throw new Error("Uso: <clienteId> <desde> <hacia> <monto> [--commit]");
const h = createClient(process.env.HECOM_SUPABASE_URL, process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: cobros, error } = await h.from("cobros").select("*").eq("client_id", ID);
if (error) throw error;
const ofMonth = cobros.filter((co) => arrastre.ymOfCobro(co) === FROM);
const pick = arrastre.pickCobros(ofMonth, Number(MONTO));
if (pick.error) throw new Error(pick.error);
for (const co of pick.whole) console.log(`entero: ${co.fecha} ${co.monto} ${co.codigo}`);
if (pick.split) console.log(`parte: ${pick.split.move} de ${pick.split.cobro.monto} ${pick.split.cobro.codigo} (queda ${pick.split.keepMonto})`);
if (!COMMIT) { console.log("Solo muestra. Con --commit se aplica."); process.exit(0); }

const nota = `Ajuste ${new Date().toISOString().slice(0, 10)}: saldo a favor de ${FROM} pasa a ${TO} (orden de gerencia)`;
for (const co of pick.whole) {
  const { error: e } = await h.from("cobros").update({ periodo_resumen: TO, notas: [co.notas, nota].filter(Boolean).join(" · ") }).eq("id", co.id);
  if (e) throw e;
}
if (pick.split) {
  const src = pick.split.cobro;
  const { data: ins, error: e1 } = await h.from("cobros").insert({
    client_id: src.client_id, fecha: src.fecha, hora: src.hora || null, monto: pick.split.move, metodo: src.metodo,
    codigo: `${src.codigo || ""} · ajuste ${TO}`.trim(), comprobante_urls: src.comprobante_urls || null, periodo_resumen: TO, notas: nota,
  }).select("id").single();
  if (e1) throw e1;
  const patch = { monto: pick.split.keepMonto, notas: [src.notas, nota].filter(Boolean).join(" · ") };
  if (pick.split.breakdown) patch.funding_breakdown = pick.split.breakdown;
  const { error: e2 } = await h.from("cobros").update(patch).eq("id", src.id);
  if (e2) { await h.from("cobros").delete().eq("id", ins.id); throw e2; }
}
console.log("✓ aplicado");
