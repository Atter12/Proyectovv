/**
 * Smoke Cobrana cert:
 * 1) Verifica HMAC X-Cobrana-Signature localmente
 * 2) Si hay COBRANA_SECRET_KEY, crea un charge services de prueba
 * 3) Si hay DATABASE_URL, asegura enum payment_provider incluye cobrana
 *
 * Uso: node --env-file=.env.local scripts/smoke-cobrana-cert.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function env(name, fallback = "") {
  const v = (process.env[name] ?? "").trim();
  return v || fallback;
}

function verifySignature(rawBody, signatureHeader, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(v1, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function sign(rawBody, secret, t = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex");
  return `t=${t},v1=${v1}`;
}

async function ensureEnum() {
  const databaseUrl = env("DATABASE_URL");
  if (!databaseUrl) {
    console.log("ENUM_SKIP no DATABASE_URL");
    return;
  }
  const { Client } = await import("pg");
  const sqlPath = path.join(root, "supabase/migrations/023_payment_provider_cobrana.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    const r = await client.query(`
      select e.enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'payment_provider'
      order by e.enumsortorder
    `);
    const labels = r.rows.map((x) => x.enumlabel);
    if (!labels.includes("cobrana")) {
      throw new Error(`enum payment_provider sin cobrana: ${labels.join(",")}`);
    }
    console.log("ENUM_OK", labels.join(","));
  } finally {
    await client.end();
  }
}

async function createTestCharge() {
  const secretKey = env("COBRANA_SECRET_KEY");
  const base = env("COBRANA_API_BASE_URL", "https://api.cert.cobrana.pe/v1").replace(/\/$/, "");
  const option = env("COBRANA_SERVICES_OPTION", "cobrana");
  const feeMode = env("COBRANA_FEE_MODE", "merchant");
  const dni = env("COBRANA_SMOKE_DNI");
  const name = env("COBRANA_SMOKE_NAME", "Smoke");
  const lastname = env("COBRANA_SMOKE_LASTNAME", "Test");

  if (!secretKey) {
    console.log("CHARGE_SKIP COBRANA_SECRET_KEY vacío — pegá sk_test_ en .env.local");
    return null;
  }
  if (!dni) {
    console.log("CHARGE_SKIP falta COBRANA_SMOKE_DNI (DNI de prueba en CRM/cert)");
    return null;
  }

  const idem = `smoke-cobrana-${Date.now()}`;
  const body = {
    amount: 10,
    currency: "PEN",
    concept: "Smoke Holistic Yape",
    method: "services",
    option,
    feeMode,
    customer: {
      documentNumber: dni,
      name,
      lastname,
      email: env("COBRANA_SMOKE_EMAIL", "smoke@adsholistic.com"),
    },
    externalRef: `smoke_${Date.now()}`.slice(0, 100),
    metadata: { smoke: true, source: "scripts/smoke-cobrana-cert.mjs" },
  };

  const res = await fetch(`${base}/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": idem,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `CHARGE_FAIL HTTP ${res.status}: ${json?.error?.message || JSON.stringify(json)}`,
    );
  }
  console.log("CHARGE_OK", {
    id: json.id,
    status: json.status,
    code: json.code,
    deeplinks: (json.deeplinks || []).map((d) => d.key),
  });
  console.log(
    "NEXT: en panel Cobrana → Marcar como pagado → webhook https://www.adsholistic.com/api/webhooks/payments/cobrana",
  );
  return json;
}

async function main() {
  console.log("=== smoke cobrana cert ===");

  const webhookSecret = env("COBRANA_WEBHOOK_SECRET", "whsec_test_local");
  const raw = JSON.stringify({
    id: "evt_smoke_1",
    type: "charge.paid",
    data: { object: { id: "chg_smoke", status: "paid", amount: 10, currency: "PEN" } },
  });
  const header = sign(raw, webhookSecret);
  const ok = verifySignature(raw, header, webhookSecret);
  if (!ok) throw new Error("SIG_FAIL verify local HMAC");
  console.log("SIG_OK X-Cobrana-Signature");

  await ensureEnum();
  await createTestCharge();

  console.log("SMOKE_DONE");
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e.message || e);
  process.exit(1);
});
