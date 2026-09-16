/**
 * Conciliación de cobros Proyectovv <-> Hecom. SOLO LECTURA por defecto.
 *
 * Compara plata contra plata: cada pago acreditado en la app contra su cobro en
 * Hecom (monto, cliente, fecha, período) y después el total por cliente, que es
 * lo que el equipo ve en el CRM.
 *
 * Usage:
 *   node scripts/audit-cobros-conciliacion.mjs
 *   node scripts/audit-cobros-conciliacion.mjs --fix-duplicados   (borra cobros AH-* repetidos)
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const fixDuplicados = args.has("--fix-duplicados");

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
const app = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function all(client, table, select) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const usd = (n) => `$${(n ?? 0).toFixed(2)}`;

const cobros = await all(
  hecom,
  "cobros",
  "id, codigo, monto, fecha, metodo, client_id, periodo_resumen, notas",
);
const clientes = await all(hecom, "clientes", "id, name");
const intents = await all(
  app,
  "payment_intents",
  "id, amount_cents, currency, provider, status, created_at, succeeded_at, metadata",
);

const nombre = new Map(clientes.map((c) => [c.id, c.name]));
const PREFIX = {
  stripe: "AH-STRIPE-",
  manual: "AH-BCP-",
  cobrana: "AH-YAPE-",
  crypto: "AH-CRYPTO-",
};
const BRIDGED = Object.keys(PREFIX);

/**
 * Mismo criterio que la app para "esto no es un pago de cliente":
 * ver isAgencyBmBridgeIntent en services/payments.service.ts y el filtro de
 * lib/admin/data.ts. Son puentes contables del gerente e importaciones de
 * saldo, y por eso no salen en "Lo pagado" ni deben generar cobro.
 */
const esAjuste = (m) => {
  const source = String(m?.source ?? "").trim();
  const purpose = String(m?.purpose ?? "").trim();
  return (
    source === "agency_bm_bridge" ||
    source === "tiktok_balance_import" ||
    source === "tiktok_reclaim" ||
    source === "credito_detach" ||
    purpose === "staff_fund_from_bm" ||
    purpose === "transfer_existing_tiktok_balance" ||
    Boolean(String(m?.bridge_for_allocation ?? "").trim()) ||
    Boolean(String(m?.agency_bm_bridge_journal_id ?? "").trim()) ||
    m?.skip_wallet_credit === true
  );
};

/** Bruto en USD que el puente debería haber mandado (misma lógica que ensure-wallet-cobro). */
function brutoEsperadoUsd(p) {
  const m = p.metadata ?? {};
  const gross = num(m.gross_usd_cents);
  if (gross && gross > 0) return gross / 100;
  if (String(p.currency).toUpperCase() === "USD") return p.amount_cents / 100;
  const credit = num(m.credit_amount_cents);
  return credit != null ? credit / 100 : p.amount_cents / 100;
}

console.log("Conciliación de cobros Proyectovv <-> Hecom");
console.log(`Fecha: ${new Date().toISOString()}`);
console.log(`Modo: ${fixDuplicados ? "FIX DUPLICADOS" : "SOLO LECTURA"}\n`);

// ------------------------------------------------ 1. duplicados (doble cobro)
console.log("=== 1. Cobros cargados más de una vez ===");
const porCodigo = new Map();
for (const c of cobros) {
  if (!c.codigo) continue;
  porCodigo.set(c.codigo, [...(porCodigo.get(c.codigo) ?? []), c]);
}
const duplicados = [...porCodigo.entries()].filter(([, v]) => v.length > 1);
if (!duplicados.length) {
  console.log("Ninguno. Cada pago está una sola vez.");
} else {
  for (const [cod, filas] of duplicados) {
    const total = filas.reduce((a, b) => a + (num(b.monto) ?? 0), 0);
    const real = num(filas[0].monto) ?? 0;
    console.log(
      `  ${nombre.get(filas[0].client_id) ?? filas[0].client_id} | ${filas.length} filas | registrado ${usd(total)} por un pago de ${usd(real)} | de más: ${usd(total - real)}`,
    );
    console.log(`     codigo: ${cod}`);
    for (const f of filas) {
      console.log(`       fila ${f.id} | fecha=${f.fecha} | periodo=${f.periodo_resumen}`);
    }
  }
}

if (fixDuplicados && duplicados.length) {
  console.log("\n  --- borrando las filas de más (deja la más antigua) ---");
  for (const [cod, filas] of duplicados) {
    if (!cod.startsWith("AH-")) {
      console.log(`  SKIP ${cod}: no es un cobro automático, no lo toco.`);
      continue;
    }
    // Se queda la primera creada; las demás son la carrera del puente.
    const ordenadas = [...filas].sort((a, b) =>
      String(a.id) < String(b.id) ? -1 : 1,
    );
    for (const sobrante of ordenadas.slice(1)) {
      const { error } = await hecom
        .from("cobros")
        .delete()
        .eq("id", sobrante.id)
        .eq("codigo", cod); // guarda: no borrar si cambió mientras corría
      console.log(
        error
          ? `  FAIL ${sobrante.id}: ${error.message}`
          : `  borrada ${sobrante.id} (${usd(num(sobrante.monto))}) de ${nombre.get(sobrante.client_id)}`,
      );
    }
    console.log(`  queda 1 fila: ${ordenadas[0].id}`);
  }
}

// -------------------------------------- 2. pago por pago: monto/cliente/fecha
console.log("\n=== 2. Pago por pago (monto, cliente, fecha, período) ===");
const cobroPorCodigo = new Map();
for (const [cod, filas] of porCodigo) cobroPorCodigo.set(cod, filas[0]);

const problemas = [];
const okList = [];
const sinCobro = [];
/** payment_intent -> cobro que le corresponde (sea AH-* o código de soporte). */
const cobroDePago = new Map();
const relevantes = intents.filter(
  (p) =>
    p.status === "succeeded" &&
    BRIDGED.includes(p.provider) &&
    !esAjuste(p.metadata ?? {}),
);

for (const p of relevantes) {
  const m = p.metadata ?? {};
  const codigo = m.hecom_cobro_sync?.codigo ?? `${PREFIX[p.provider]}${p.id}`;
  const cobro = cobroPorCodigo.get(codigo);
  const clienteId = typeof m.hecom_cliente_id === "string" ? m.hecom_cliente_id : null;
  const quien = m.hecom_cliente_name ?? nombre.get(clienteId) ?? "(sin ficha)";
  const esperado = brutoEsperadoUsd(p);
  const fechaPago = (p.succeeded_at ?? p.created_at)?.slice(0, 10);

  if (!cobro) {
    sinCobro.push({ p, quien, esperado, fechaPago, clienteId });
    continue;
  }
  cobroDePago.set(p.id, cobro);

  const fallas = [];
  const montoCobro = num(cobro.monto) ?? 0;
  if (Math.abs(montoCobro - esperado) > 0.02) {
    fallas.push(`monto: Hecom ${usd(montoCobro)} vs pago ${usd(esperado)}`);
  }
  if (clienteId && cobro.client_id !== clienteId) {
    fallas.push(
      `cliente distinto: cobro a ${nombre.get(cobro.client_id)} pero el pago es de ${quien}`,
    );
  }
  if (cobro.fecha && String(cobro.fecha).slice(0, 7) !== cobro.periodo_resumen) {
    fallas.push(`período ${cobro.periodo_resumen} != mes de pago ${String(cobro.fecha).slice(0, 7)}`);
  }
  // la fecha del cobro puede correrse 1 día por UTC vs Lima
  if (cobro.fecha && fechaPago) {
    const dif = Math.abs(
      (new Date(cobro.fecha) - new Date(fechaPago)) / 86400000,
    );
    if (dif > 1) fallas.push(`fecha ${cobro.fecha} vs pago ${fechaPago}`);
  }

  if (fallas.length) problemas.push({ p, quien, cobro, fallas });
  else okList.push({ p, quien, cobro });
}

console.log(`pagos a conciliar: ${relevantes.length}`);
console.log(`  correctos: ${okList.length}`);
console.log(`  con diferencia: ${problemas.length}`);
console.log(`  sin cobro en Hecom: ${sinCobro.length}`);

for (const x of problemas) {
  console.log(`\n  ${x.quien} | ${usd(num(x.cobro.monto))} | ${x.cobro.fecha}`);
  for (const f of x.fallas) console.log(`     ! ${f}`);
}

if (sinCobro.length) {
  console.log("\n  --- pagos sin cobro ---");
  for (const s of sinCobro.sort((a, b) => (a.fechaPago < b.fechaPago ? -1 : 1))) {
    console.log(
      `  ${s.fechaPago} | ${usd(s.esperado)} | ${s.p.provider}/${s.p.metadata?.source ?? "-"} | ${s.quien}${s.clienteId ? "" : "  <- sin ficha, no se puede puentear"}`,
    );
  }
}

// ------------------------------------------------ 3. total por cliente
console.log("\n=== 3. Total por cliente: app vs Hecom ===");
// Se compara el pago contra el cobro que le corresponde, sea automático (AH-*)
// o cargado por soporte (C-*): a los pagos viejos, de antes del puente, el
// equipo les hizo el cobro a mano y igual están registrados.
const porCliente = new Map();
function fila(id) {
  const r = porCliente.get(id) ?? { app: 0, hecom: 0, nPagos: 0, nCobros: 0 };
  porCliente.set(id, r);
  return r;
}
for (const p of relevantes) {
  const id = p.metadata?.hecom_cliente_id;
  if (typeof id !== "string") continue;
  const r = fila(id);
  r.app += brutoEsperadoUsd(p);
  r.nPagos++;
  const cobro = cobroDePago.get(p.id);
  if (cobro) {
    r.hecom += num(cobro.monto) ?? 0;
    r.nCobros++;
  }
}

const desajustes = [];
for (const [id, r] of porCliente) {
  if (Math.abs(r.app - r.hecom) > 0.02) desajustes.push({ id, ...r });
}
console.log(`clientes con movimiento: ${porCliente.size}`);
console.log(`  cuadrados: ${porCliente.size - desajustes.length}`);
console.log(`  descuadrados: ${desajustes.length}`);
for (const d of desajustes.sort((a, b) => Math.abs(b.app - b.hecom) - Math.abs(a.app - a.hecom))) {
  const dif = d.hecom - d.app;
  console.log(
    `  ${nombre.get(d.id) ?? d.id}: app ${usd(d.app)} (${d.nPagos} pagos) vs Hecom ${usd(d.hecom)} (${d.nCobros} cobros) -> ${dif > 0 ? "Hecom cobró " + usd(dif) + " de MÁS" : "Hecom le falta " + usd(-dif)}`,
  );
}

const totalApp = [...porCliente.values()].reduce((a, b) => a + b.app, 0);
const totalHecom = [...porCliente.values()].reduce((a, b) => a + b.hecom, 0);
console.log(
  `\n  TOTAL: app ${usd(totalApp)} vs Hecom ${usd(totalHecom)} | diferencia ${usd(totalHecom - totalApp)}`,
);

// Cobros de soporte que cubren pagos de la app: no son un problema, pero
// conviene saber cuántos son para no contarlos dos veces.
const deSoporte = [...cobroDePago.values()].filter(
  (c) => !c.codigo?.startsWith("AH-"),
);
if (deSoporte.length) {
  console.log(
    `\n  (${deSoporte.length} pago(s) están registrados con código de soporte en vez de AH-*, por ${usd(deSoporte.reduce((a, b) => a + (num(b.monto) ?? 0), 0))}: son de antes del puente y están bien)`,
  );
}

console.log("\n================ CIERRE ================");
const criticos =
  duplicados.length + problemas.length + desajustes.length;
console.log(
  criticos === 0
    ? ">>> COBROS EN ORDEN: cada pago tiene su cobro, por el monto correcto, al cliente correcto y en su mes."
    : `Quedan ${criticos} punto(s) a revisar arriba.`,
);
if (!fixDuplicados) console.log("\n(solo lectura: no se modificó nada)");
