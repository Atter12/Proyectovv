/**
 * Backfill bridge Hecom "Lo pagado" para depósitos de cartera.
 *
 * Cubre todos los canales puenteados (stripe / manual / cobrana / crypto), no
 * solo Stripe: los auto-abonos de Yape y de banco manual acreditaban saldo sin
 * registrar el cobro, así que también hay que poder curarlos.
 *
 * Default: solo filas sin hecom_cobro_sync.ok (o fallidas).
 * Actualiza payment_intents.metadata tras cada llamada exitosa al bridge.
 *
 * Usage:
 *   node scripts/backfill-hecom-wallet-cobros.mjs --dry-run
 *   node scripts/backfill-hecom-wallet-cobros.mjs --commit
 *   node scripts/backfill-hecom-wallet-cobros.mjs --commit --provider=manual
 *   node scripts/backfill-hecom-wallet-cobros.mjs --commit --only=jesus
 *   node scripts/backfill-hecom-wallet-cobros.mjs --commit --all
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const doCommit = args.has("--commit");
const includeAlreadyOk = args.has("--all");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length).toLowerCase() : null;
const providerArg = process.argv.find((a) => a.startsWith("--provider="));
const BRIDGED_PROVIDERS = ["stripe", "manual", "cobrana", "crypto"];
const providers = providerArg
  ? providerArg.slice("--provider=".length).toLowerCase().split(",")
  : BRIDGED_PROVIDERS;

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

const bridgeUrl =
  env.HECOM_COBROS_BRIDGE_URL ||
  "https://www.hecom.club/api/credito-cobros-holistic-wallet";
const bridgeSecret = env.HECOM_COBROS_BRIDGE_SECRET || "";
if (!bridgeSecret) {
  console.error("Falta HECOM_COBROS_BRIDGE_SECRET");
  process.exit(1);
}

const NAME_FILTERS = {
  jesus: /jesus\s*fuentes/i,
  dominic: /dominic/i,
  catherine: /catherine/i,
  adrian: /adrian|adrián/i,
  boris: /boris/i,
  ximena: /ximena/i,
  williams: /williams|andrade/i,
};

const vv = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function syncOk(meta) {
  const s = meta?.hecom_cobro_sync;
  return Boolean(s && typeof s === "object" && s.ok === true);
}

const { data: pis, error } = await vv
  .from("payment_intents")
  .select(
    "id,amount_cents,currency,provider,metadata,succeeded_at,created_at",
  )
  .eq("status", "succeeded")
  .in("provider", providers)
  .order("created_at", { ascending: true });
if (error) throw error;

// Importes de saldo TikTok y cobros de deuda no son pagos del cliente.
function esAjusteInterno(m) {
  const source = String(m.source ?? "");
  return (
    /tiktok_balance_import|tiktok_reclaim|credito_detach/.test(source) ||
    m.skip_wallet_credit === true
  );
}

const rows = [];
const sinCliente = [];
for (const pi of pis ?? []) {
  const m = pi.metadata || {};
  const hecomId = m.hecom_cliente_id ? String(m.hecom_cliente_id) : "";
  const hecomName = m.hecom_cliente_name ? String(m.hecom_cliente_name) : "";
  if (esAjusteInterno(m)) continue;
  if (!includeAlreadyOk && syncOk(m)) continue;
  if (!hecomId) {
    sinCliente.push({
      id: pi.id,
      provider: pi.provider,
      source: String(m.source ?? "-"),
      monto: Number(pi.amount_cents) / 100,
      fecha: (pi.succeeded_at || pi.created_at)?.slice?.(0, 10),
    });
    continue;
  }
  if (only) {
    const re = NAME_FILTERS[only];
    if (!re || !re.test(hecomName)) continue;
  }

  const credit =
    m.credit_amount_cents != null
      ? Number(m.credit_amount_cents)
      : Number(pi.amount_cents);
  // Hecom opera en USD. En cargos PEN el amount_cents es soles, así que el
  // bruto sale de gross_usd_cents (o del crédito) o mandaríamos soles como
  // si fueran dólares.
  const currency = String(pi.currency || "USD").toUpperCase();
  const grossUsd =
    m.gross_usd_cents != null && Number(m.gross_usd_cents) > 0
      ? Number(m.gross_usd_cents)
      : currency === "USD"
        ? Number(pi.amount_cents)
        : credit;
  const fee =
    m.fee_amount_cents != null && currency === "USD"
      ? Number(m.fee_amount_cents)
      : Math.max(0, grossUsd - credit);

  rows.push({
    client_id: hecomId,
    client_name: hecomName || hecomId,
    payment_intent_id: pi.id,
    provider: pi.provider,
    monto_bruto: grossUsd / 100,
    monto_neto: credit / 100,
    fee_holistic: fee / 100,
    currency: "USD",
    paid_at: pi.succeeded_at || pi.created_at,
    metadata: m,
  });
}

console.log(
  `Mode: ${doCommit ? "COMMIT" : "DRY-RUN"} | providers=${providers.join(",")} | missing/failed rows=${rows.length}` +
    (only ? ` | only=${only}` : "") +
    (includeAlreadyOk ? " | --all" : ""),
);

if (sinCliente.length) {
  console.log(
    `\n${sinCliente.length} pago(s) sin hecom_cliente_id — imposible puentear, revisar a mano:`,
  );
  for (const x of sinCliente) {
    console.log(`  ${x.fecha} | $${x.monto} | ${x.provider}/${x.source} | pi=${x.id}`);
  }
  console.log("");
}
console.log(`URL: ${bridgeUrl}\n`);

if (!rows.length) {
  console.log("Nada pendiente.");
  process.exit(0);
}

let ok = 0;
let fail = 0;
const byClient = new Map();

for (const r of rows) {
  const payload = {
    client_id: r.client_id,
    payment_intent_id: r.payment_intent_id,
    monto_bruto: r.monto_bruto,
    monto_neto: r.monto_neto,
    fee_holistic: r.fee_holistic,
    currency: r.currency,
    provider: r.provider,
    paid_at: r.paid_at,
    dry_run: !doCommit,
  };

  const res = await fetch(bridgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bridgeSecret}`,
      "x-holistic-cobros-secret": bridgeSecret,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  const lineOk = Boolean(json.ok);
  if (lineOk) ok += 1;
  else fail += 1;

  const prev = byClient.get(r.client_name) || { n: 0, sum: 0, ok: 0 };
  prev.n += 1;
  prev.sum += r.monto_bruto;
  if (lineOk) prev.ok += 1;
  byClient.set(r.client_name, prev);

  console.log(
    `${lineOk ? "OK" : "FAIL"} | ${r.client_name} | ${r.provider} | $${r.monto_bruto} | ${r.paid_at?.slice?.(0, 10) || "-"} | ${json.dry_run ? "dry" : json.created ? "created" : json.idempotent ? "idempotent" : "?"} | ${json.error || json.codigo || ""}${json.periodo_resumen ? " | periodo=" + json.periodo_resumen : ""}`,
  );

  if (doCommit && lineOk) {
    const syncMeta = {
      ok: true,
      skipped: false,
      reason: null,
      cobro_id: json.cobro_id ?? null,
      codigo: json.codigo ?? null,
      periodo_resumen: json.periodo_resumen ?? null,
      at: new Date().toISOString(),
      backfill: true,
      idempotent: Boolean(json.idempotent),
      created: Boolean(json.created),
    };
    const { error: upErr } = await vv
      .from("payment_intents")
      .update({
        metadata: {
          ...r.metadata,
          hecom_cobro_sync: syncMeta,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.payment_intent_id);
    if (upErr) {
      console.warn("  metadata update failed:", upErr.message);
    }
  }
}

console.log("\n=== Por cliente ===");
for (const [name, v] of [...byClient.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`${name}: ${v.ok}/${v.n} ok · $${v.sum.toFixed(2)}`);
}

console.log(`\nDone: ok=${ok} fail=${fail}`);
if (fail) process.exit(2);
