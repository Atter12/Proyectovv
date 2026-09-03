/**
 * Dry-run: lista depósitos Stripe reales → payload bridge Hecom (bruto).
 * No escribe cobros. Uso:
 *   node scripts/dry-run-hecom-wallet-cobros.mjs
 * Con commit (cuando endpoint + secret listos):
 *   HECOM_COBROS_BRIDGE_COMMIT=1 node scripts/dry-run-hecom-wallet-cobros.mjs
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

const IGNORE_EMAILS = new Set([
  "sandrowonmer@gmail.com",
  "sandrowong82@gmail.com",
  "atlvbasiliorengifo@gmail.com",
  "attermayerbasiliorengifo@gmail.com",
  "branlyn.lopez.r@gmail.com",
]);

const vv = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const commit = process.env.HECOM_COBROS_BRIDGE_COMMIT === "1";
const bridgeUrl =
  env.HECOM_COBROS_BRIDGE_URL ||
  "https://www.hecom.club/api/credito-cobros-holistic-wallet";
const bridgeSecret = env.HECOM_COBROS_BRIDGE_SECRET || "";

const { data: pis, error } = await vv
  .from("payment_intents")
  .select(
    "id,amount_cents,currency,provider,provider_reference,status,metadata,succeeded_at,created_at,created_by",
  )
  .eq("status", "succeeded")
  .eq("provider", "stripe")
  .order("created_at", { ascending: true });
if (error) throw error;

const userIds = [...new Set((pis ?? []).map((p) => p.created_by).filter(Boolean))];
const { data: profiles } = await vv
  .from("profiles")
  .select("id,email")
  .in("id", userIds);
const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

const rows = [];
for (const pi of pis ?? []) {
  const m = pi.metadata || {};
  const hecomId = m.hecom_cliente_id ? String(m.hecom_cliente_id) : "";
  const hecomName = m.hecom_cliente_name
    ? String(m.hecom_cliente_name)
    : "";
  const byEmail = String(emailById.get(pi.created_by) || "").toLowerCase();
  if (!hecomId) continue;
  if (IGNORE_EMAILS.has(byEmail)) continue;

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
    client_name: hecomName || "(sin nombre meta)",
    payment_intent_id: pi.id,
    monto_bruto: Number(pi.amount_cents) / 100,
    monto_neto: credit / 100,
    fee_holistic: fee / 100,
    currency: pi.currency || "USD",
    paid_at: pi.succeeded_at || pi.created_at,
    codigo: `AH-STRIPE-${pi.id}`,
    provider_reference: pi.provider_reference,
  });
}

console.log(`Candidatos Stripe→Hecom: ${rows.length} (monto = BRUTO)\n`);
const byClient = new Map();
for (const r of rows) {
  const cur = byClient.get(r.client_id) || {
    name: r.client_name,
    bruto: 0,
    neto: 0,
    n: 0,
  };
  cur.bruto += r.monto_bruto;
  cur.neto += r.monto_neto;
  cur.n += 1;
  byClient.set(r.client_id, cur);
}
for (const [id, c] of [...byClient.entries()].sort(
  (a, b) => b[1].bruto - a[1].bruto,
)) {
  console.log(
    `${c.name} | hecom:${id.slice(0, 8)} | bruto $${c.bruto.toFixed(2)} | neto $${c.neto.toFixed(2)} | ${c.n} PI`,
  );
}

console.log("\n=== PAYLOADS ===");
for (const r of rows) {
  console.log(JSON.stringify(r));
}

if (!commit) {
  console.log(
    "\nDry-run only. Para llamar endpoint: HECOM_COBROS_BRIDGE_COMMIT=1 + secret en .env.local",
  );
  process.exit(0);
}

if (!bridgeSecret) {
  console.error("Falta HECOM_COBROS_BRIDGE_SECRET");
  process.exit(1);
}

console.log(`\n=== COMMIT dry_run=true primero contra ${bridgeUrl} ===`);
for (const r of rows) {
  const res = await fetch(bridgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bridgeSecret}`,
    },
    body: JSON.stringify({ ...r, dry_run: true }),
  });
  const json = await res.json().catch(() => ({}));
  console.log(
    `${r.client_name} ${r.codigo.slice(0, 24)}… → ${res.status}`,
    JSON.stringify(json).slice(0, 200),
  );
}
