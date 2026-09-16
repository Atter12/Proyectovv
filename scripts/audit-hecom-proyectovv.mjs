/**
 * Auditoría del borde Proyectovv <-> Hecom Club. SOLO LECTURA: no escribe nada.
 *
 * Revisa lo que puede desincronizarse entre los dos sistemas:
 *   1. Cobros: pagos de la app sin cobro en Hecom, y cobros AH-* huérfanos
 *   2. Período de los cobros automáticos
 *   3. Fichas: duplicados por DNI / email, fichas sin email (no pueden entrar)
 *   4. Cuentas TikTok: mapeos, fee sospechoso, principal sin mapeo
 *   5. ad_accounts de la app: filas duplicadas y orgs que no resuelven
 *
 * Usage: node scripts/audit-hecom-proyectovv.mjs
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

/** PostgREST corta en 1000: sin esto la auditoría da falsos positivos. */
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

const hallazgos = [];
function anotar(sev, area, titulo, detalle) {
  hallazgos.push({ sev, area, titulo, detalle });
}

console.log("Auditoría Proyectovv <-> Hecom Club (solo lectura)");
console.log(`Fecha: ${new Date().toISOString()}\n`);

// ---------------------------------------------------------------- datos base
const cobros = await all(
  hecom,
  "cobros",
  "id, codigo, monto, fecha, metodo, client_id, periodo_resumen",
);
const clientes = await all(
  hecom,
  "clientes",
  "id, name, dni, emails, tiktok_advertiser_id, tiktok_advertiser_name, tiktok_default_fee",
);
const mapeos = await all(
  hecom,
  "cliente_tiktok_cuentas",
  "id, client_id, advertiser_id, advertiser_name, bm_bucket, fee",
);
const intents = await all(
  app,
  "payment_intents",
  "id, organization_id, amount_cents, currency, provider, status, created_at, succeeded_at, metadata",
);
const adAccounts = await all(
  app,
  "ad_accounts",
  "id, organization_id, external_account_id, name, status",
);
const orgs = await all(app, "organizations", "id, name");

const nombreCliente = new Map(clientes.map((c) => [c.id, c.name]));
const orgNombre = new Map(orgs.map((o) => [o.id, o.name]));

console.log(
  `Hecom:  ${clientes.length} fichas · ${cobros.length} cobros · ${mapeos.length} mapeos TikTok`,
);
console.log(
  `App:    ${intents.length} payment_intents · ${adAccounts.length} ad_accounts · ${orgs.length} orgs\n`,
);

// ------------------------------------------------- 1. cobros vs pagos de app
const PREFIX = {
  stripe: "AH-STRIPE-",
  manual: "AH-BCP-",
  cobrana: "AH-YAPE-",
  crypto: "AH-CRYPTO-",
};
const porCodigo = new Map();
for (const c of cobros) if (c.codigo) porCodigo.set(c.codigo, c);

/** Mismo criterio que la app (isAgencyBmBridgeIntent): no son pagos de cliente. */
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

const succeeded = intents.filter((p) => p.status === "succeeded");
const sinCobro = [];
for (const p of succeeded) {
  const m = p.metadata ?? {};
  if (esAjuste(m)) continue;
  const codigo = m.hecom_cobro_sync?.codigo;
  const enHecom =
    (codigo && porCodigo.has(codigo)) ||
    (PREFIX[p.provider] && porCodigo.has(`${PREFIX[p.provider]}${p.id}`));
  if (!enHecom) {
    sinCobro.push({
      id: p.id,
      fecha: (p.succeeded_at ?? p.created_at)?.slice(0, 10),
      monto: p.amount_cents / 100,
      cur: p.currency,
      provider: p.provider,
      source: String(m.source ?? "-"),
      cliente: m.hecom_cliente_name ?? null,
      clienteId: m.hecom_cliente_id ?? null,
    });
  }
}
console.log("=== 1. Pagos acreditados sin cobro en Hecom ===");
console.log(`${sinCobro.length} de ${succeeded.length} pagos succeeded`);
const g1 = {};
for (const r of sinCobro) {
  const k = `${r.provider}/${r.source}`;
  g1[k] = g1[k] ?? { n: 0, monto: 0, conCliente: 0 };
  g1[k].n++;
  g1[k].monto += r.monto;
  if (r.clienteId) g1[k].conCliente++;
}
for (const [k, v] of Object.entries(g1).sort((a, b) => b[1].n - a[1].n)) {
  console.log(
    `  ${k}: ${v.n} pagos · $${v.monto.toFixed(2)} · con ficha: ${v.conCliente}`,
  );
  if (v.conCliente > 0) {
    anotar(
      "ALTA",
      "cobros",
      `${v.conCliente} pago(s) de ${k} con ficha y sin cobro`,
      "Se acreditó saldo al cliente y no quedó registrado en Hecom. Curar con backfill-hecom-wallet-cobros.mjs",
    );
  }
}
if (sinCobro.filter((r) => !r.clienteId).length) {
  anotar(
    "MEDIA",
    "cobros",
    `${sinCobro.filter((r) => !r.clienteId).length} pago(s) sin hecom_cliente_id`,
    "No se pueden puentear automáticamente: hay que decidir a qué ficha van o si son internos.",
  );
}

// ------------------------------------------- 2. cobros AH-* huérfanos / raros
console.log("\n=== 2. Cobros automáticos (AH-*) contra la app ===");
const idIntent = new Map(intents.map((p) => [p.id, p]));
const automaticos = cobros.filter((c) => c.codigo?.startsWith("AH-"));
const huerfanos = [];
const noSucceeded = [];
const desalineados = [];
for (const c of automaticos) {
  const pi = String(c.codigo).replace(
    /^AH-(STRIPE|BCP|YAPE|CRYPTO)-/,
    "",
  );
  const intent = idIntent.get(pi);
  if (!intent) huerfanos.push(c);
  else if (intent.status !== "succeeded")
    noSucceeded.push({ c, status: intent.status });
  if (c.fecha && c.periodo_resumen !== String(c.fecha).slice(0, 7)) {
    desalineados.push(c);
  }
}
console.log(`total AH-*: ${automaticos.length}`);
console.log(`  sin payment_intent en la app: ${huerfanos.length}`);
for (const c of huerfanos) {
  console.log(
    `     ${c.fecha} | $${c.monto} | ${nombreCliente.get(c.client_id) ?? c.client_id} | ${c.codigo}`,
  );
}
console.log(`  con intent que NO está succeeded: ${noSucceeded.length}`);
for (const x of noSucceeded) {
  console.log(
    `     ${x.c.fecha} | $${x.c.monto} | ${nombreCliente.get(x.c.client_id) ?? x.c.client_id} | intent=${x.status} | ${x.c.codigo}`,
  );
}
console.log(`  con periodo != mes de pago: ${desalineados.length}`);
if (huerfanos.length) {
  anotar(
    "ALTA",
    "cobros",
    `${huerfanos.length} cobro(s) AH-* sin pago en la app`,
    "Cobro cargado al cliente sin respaldo en Proyectovv. Revisar si fue prueba o si el intent se borró.",
  );
}
if (noSucceeded.length) {
  anotar(
    "ALTA",
    "cobros",
    `${noSucceeded.length} cobro(s) AH-* cuyo pago no está succeeded`,
    "Se le cobró al cliente por un pago cancelado o pendiente. Verificar uno por uno.",
  );
}
if (desalineados.length) {
  anotar(
    "MEDIA",
    "cobros",
    `${desalineados.length} cobro(s) AH-* fuera de su mes de pago`,
    "Correr realign-hecom-cobro-periodos.mjs (o revisar si HECOM_COBRO_PERIODO_ALIGN quedó apagado).",
  );
}

// duplicados por código
const vistos = new Map();
const dupCodigo = [];
for (const c of cobros) {
  if (!c.codigo) continue;
  if (vistos.has(c.codigo)) dupCodigo.push(c.codigo);
  else vistos.set(c.codigo, c);
}
console.log(`  códigos duplicados: ${dupCodigo.length}`);
for (const cod of dupCodigo) {
  const filas = cobros.filter((c) => c.codigo === cod);
  const monto = filas.reduce((a, b) => a + Number(b.monto ?? 0), 0);
  console.log(
    `     ${cod} | ${nombreCliente.get(filas[0].client_id) ?? filas[0].client_id} | ${filas.length} filas · $${monto.toFixed(2)} registrados por un pago de $${filas[0].monto}`,
  );
}
if (dupCodigo.length) {
  anotar(
    "ALTA",
    "cobros",
    `${dupCodigo.length} cobro(s) cargados dos veces al cliente`,
    "El código es la llave anti-doble-cobro y no tiene índice único en Hecom: dos llamadas simultáneas insertan dos cobros. Falta UNIQUE en cobros.codigo.",
  );
}

// ------------------------------------------------------------- 3. fichas
console.log("\n=== 3. Fichas de Hecom ===");
const porDni = new Map();
const porEmail = new Map();
let sinEmail = 0;
let dniPlaceholder = 0;
for (const c of clientes) {
  const dni = String(c.dni ?? "").trim();
  if (dni && !dni.startsWith("CL-")) {
    porDni.set(dni, [...(porDni.get(dni) ?? []), c]);
  }
  if (dni.startsWith("CL-")) dniPlaceholder++;
  const emails = Array.isArray(c.emails) ? c.emails : [];
  if (!emails.length) sinEmail++;
  for (const e of emails) {
    const k = String(e).trim().toLowerCase();
    if (!k) continue;
    porEmail.set(k, [...(porEmail.get(k) ?? []), c]);
  }
}
const dupDni = [...porDni.entries()].filter(([, v]) => v.length > 1);
const dupEmail = [...porEmail.entries()].filter(([, v]) => v.length > 1);
console.log(`fichas: ${clientes.length}`);
console.log(`  DNI repetido (posible ficha duplicada): ${dupDni.length}`);
for (const [dni, v] of dupDni) {
  console.log(`     ${dni}: ${v.map((x) => `${x.name} (${x.id.slice(0, 8)})`).join("  |  ")}`);
}
console.log(`  email repetido en 2+ fichas: ${dupEmail.length}`);
for (const [em, v] of dupEmail) {
  console.log(`     ${em}: ${v.map((x) => `${x.name} (${x.id.slice(0, 8)})`).join("  |  ")}`);
}
console.log(`  sin ningún email (no pueden entrar a la plataforma): ${sinEmail}`);
console.log(`  con DNI placeholder CL-*: ${dniPlaceholder}`);
if (dupDni.length) {
  anotar(
    "ALTA",
    "fichas",
    `${dupDni.length} DNI en más de una ficha`,
    "Duplicados como el caso Piero: la plata y las cuentas se reparten entre dos fichas. Unificar.",
  );
}
if (dupEmail.length) {
  anotar(
    "ALTA",
    "fichas",
    `${dupEmail.length} email en más de una ficha`,
    "Al entrar a la plataforma el email resuelve a una ficha ambigua.",
  );
}

// ------------------------------------------------- 4. cuentas TikTok mapeadas
console.log("\n=== 4. Cuentas TikTok (Hecom) ===");
const porAdv = new Map();
for (const m of mapeos) {
  porAdv.set(m.advertiser_id, [...(porAdv.get(m.advertiser_id) ?? []), m]);
}
const advDup = [...porAdv.entries()].filter(([, v]) => v.length > 1);
const feeRaro = mapeos.filter(
  (m) => m.fee != null && Number(m.fee) >= 30,
);
const primariaSinMapeo = clientes.filter((c) => {
  if (!c.tiktok_advertiser_id) return false;
  const suyos = mapeos.filter((m) => m.client_id === c.id);
  if (!suyos.length) return false; // sin mapeos el fallback es intencional
  return !suyos.some(
    (m) => String(m.advertiser_id) === String(c.tiktok_advertiser_id),
  );
});
console.log(`mapeos: ${mapeos.length}`);
console.log(`  advertiser mapeado a 2+ fichas: ${advDup.length}`);
for (const [adv, v] of advDup) {
  console.log(
    `     ${adv}: ${v.map((x) => nombreCliente.get(x.client_id) ?? x.client_id).join("  |  ")}`,
  );
}
console.log(`  fee >= 30 (posible bug fee=bm_bucket): ${feeRaro.length}`);
for (const m of feeRaro.slice(0, 15)) {
  console.log(
    `     ${nombreCliente.get(m.client_id) ?? m.client_id} | bm${m.bm_bucket} | fee=${m.fee} | ${m.advertiser_name}`,
  );
}
console.log(`  ficha con principal que no está entre sus mapeos: ${primariaSinMapeo.length}`);
for (const c of primariaSinMapeo) {
  console.log(`     ${c.name} | principal=${c.tiktok_advertiser_id}`);
}
if (advDup.length) {
  anotar(
    "ALTA",
    "cuentas",
    `${advDup.length} cuenta(s) ads mapeadas a más de un cliente`,
    "Dos clientes ven la misma cuenta. Hay que decidir de quién es.",
  );
}
if (feeRaro.length) {
  anotar(
    "ALTA",
    "cuentas",
    `${feeRaro.length} mapeo(s) con fee >= 30%`,
    "Revisar si es el bug viejo de fee = número de BM (30/200/300) o una comisión real.",
  );
}
if (primariaSinMapeo.length) {
  anotar(
    "MEDIA",
    "cuentas",
    `${primariaSinMapeo.length} ficha(s) con tiktok_advertiser_id fuera de sus mapeos`,
    "Desprolijo: el principal debería ser una de sus cuentas mapeadas.",
  );
}

// ------------------------------------------------------ 5. ad_accounts de app
console.log("\n=== 5. ad_accounts de la app ===");
const porExt = new Map();
for (const a of adAccounts) {
  if (!a.external_account_id) continue;
  porExt.set(a.external_account_id, [
    ...(porExt.get(a.external_account_id) ?? []),
    a,
  ]);
}
const extDup = [...porExt.entries()].filter(([, v]) => v.length > 1);
const orgFantasma = adAccounts.filter(
  (a) => a.organization_id && !orgNombre.has(a.organization_id),
);
// Lo que importa no es el duplicado crudo sino si el cliente lo ve: dos filas
// del mismo advertiser en orgs que existen de verdad.
const dupVisibles = [];
for (const [ext, filas] of porExt) {
  const enOrgReal = filas.filter((f) => orgNombre.has(f.organization_id));
  if (enOrgReal.length > 1) dupVisibles.push({ ext, filas: enOrgReal });
}
const orgsFantasma = [
  ...new Set(orgFantasma.map((a) => a.organization_id)),
];

console.log(`ad_accounts: ${adAccounts.length}`);
console.log(`  mismo advertiser en 2+ filas (crudo): ${extDup.length}`);
console.log(`  de esos, DUPLICADO VISIBLE por el cliente: ${dupVisibles.length}`);
for (const d of dupVisibles) {
  console.log(
    `     ${d.ext} | ${d.filas.map((f) => orgNombre.get(f.organization_id)).join(" + ")} | ${d.filas[0].name}`,
  );
}
console.log(
  `  filas colgadas (org inexistente): ${orgFantasma.length}, repartidas en ${orgsFantasma.length} org(s) borrada(s)`,
);
if (dupVisibles.length) {
  anotar(
    "ALTA",
    "app",
    `${dupVisibles.length} cuenta(s) ads duplicadas dentro de una org real`,
    "El cliente ve la misma cuenta dos veces y el saldo se reparte entre las dos filas. Dejar una.",
  );
}
if (orgFantasma.length) {
  anotar(
    "BAJA",
    "app",
    `${orgFantasma.length} ad_account(s) de org(s) borrada(s)`,
    `Restos de importaciones viejas (${orgsFantasma.length} orgs inexistentes). No se ven en ningún panel y casi no tienen movimiento; ensucian las consultas por advertiser.`,
  );
}

// ---------------------------------------------------------------- resumen
console.log("\n\n================ RESUMEN ================");
const orden = { ALTA: 0, MEDIA: 1, BAJA: 2 };
hallazgos.sort((a, b) => orden[a.sev] - orden[b.sev]);
if (!hallazgos.length) {
  console.log("Sin hallazgos. Todo alineado.");
} else {
  for (const h of hallazgos) {
    console.log(`[${h.sev}] (${h.area}) ${h.titulo}`);
    console.log(`        ${h.detalle}`);
  }
}
console.log(
  `\n${hallazgos.filter((h) => h.sev === "ALTA").length} alta · ${hallazgos.filter((h) => h.sev === "MEDIA").length} media`,
);
console.log("\nNada fue modificado: esta auditoría es solo lectura.");
