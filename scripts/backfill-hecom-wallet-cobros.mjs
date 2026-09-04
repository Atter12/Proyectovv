/**
 * Backfill bridge: dry-run o commit.
 * Usage:
 *   node scripts/backfill-hecom-wallet-cobros.mjs --dry-run --only=jesus
 *   node scripts/backfill-hecom-wallet-cobros.mjs --commit --only=jesus
 *   node scripts/backfill-hecom-wallet-cobros.mjs --dry-run
 *   node scripts/backfill-hecom-wallet-cobros.mjs --commit
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const doCommit = args.has("--commit");
const dryRun = args.has("--dry-run") || !doCommit;
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length).toLowerCase() : null;

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
};

const vv = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: pis, error } = await vv
  .from("payment_intents")
  .select(
    "id,amount_cents,currency,provider,metadata,succeeded_at,created_at",
  )
  .eq("status", "succeeded")
  .eq("provider", "stripe")
  .order("created_at", { ascending: true });
if (error) throw error;

const rows = [];
for (const pi of pis ?? []) {
  const m = pi.metadata || {};
  const hecomId = m.hecom_cliente_id ? String(m.hecom_cliente_id) : "";
  const hecomName = m.hecom_cliente_name ? String(m.hecom_cliente_name) : "";
  if (!hecomId) continue;
  if (only) {
    const re = NAME_FILTERS[only];
    if (!re || !re.test(hecomName)) continue;
  }
  const credit =
    m.credit_amount_cents != null
      ? Number(m.credit_amount_cents)
      : Number(pi.amount_cents);
  const fee =
    m.fee_amount_cents != null
      ? Number(m.fee_amount_cents)
      : Math.max(0, Number(pi.amount_cents) - credit);

  rows.push({
    client_id: hecomId,
    client_name: hecomName,
    payment_intent_id: pi.id,
    monto_bruto: Number(pi.amount_cents) / 100,
    monto_neto: credit / 100,
    fee_holistic: fee / 100,
    currency: pi.currency || "USD",
    paid_at: pi.succeeded_at || pi.created_at,
  });
}

console.log(
  `Mode: ${doCommit && !dryRun ? "COMMIT (escribe cobros)" : "DRY-RUN"} | rows=${rows.length}` +
    (only ? ` | only=${only}` : ""),
);
console.log(`URL: ${bridgeUrl}\n`);

if (!rows.length) {
  console.error("Sin filas.");
  process.exit(1);
}

let ok = 0;
let fail = 0;
const results = [];

for (const r of rows) {
  const payload = {
    client_id: r.client_id,
    payment_intent_id: r.payment_intent_id,
    monto_bruto: r.monto_bruto,
    monto_neto: r.monto_neto,
    fee_holistic: r.fee_holistic,
    currency: r.currency,
    paid_at: r.paid_at,
    dry_run: !(doCommit && !dryRun) ? true : false,
  };
  // if --commit without --dry-run, dry_run false
  if (doCommit && !args.has("--dry-run")) {
    payload.dry_run = false;
  } else {
    payload.dry_run = true;
  }

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
  const line = {
    name: r.client_name,
    pi: r.payment_intent_id.slice(0, 8),
    bruto: r.monto_bruto,
    status: res.status,
    ok: Boolean(json.ok),
    dry_run: json.dry_run,
    idempotent: json.idempotent,
    created: json.created,
    periodo:
      json.periodo_resumen ||
      json.would_insert?.periodo_resumen ||
      null,
    fecha: json.fecha || json.would_insert?.fecha || null,
    cobro_id: json.cobro_id || null,
    error: json.error || null,
  };
  results.push(line);
  if (line.ok) ok += 1;
  else fail += 1;
  console.log(
    `${line.ok ? "OK" : "FAIL"} | ${line.name} | $${line.bruto} | ${line.fecha || "-"} | periodo=${line.periodo || "-"} | ${line.dry_run ? "dry" : line.created ? "created" : line.idempotent ? "idempotent" : "?"} | ${line.error || ""}`,
  );
}

console.log(`\nDone: ok=${ok} fail=${fail}`);
if (fail) process.exit(2);
