import { readFileSync, unlinkSync, writeFileSync, existsSync } from "node:fs";
import { createHmac } from "node:crypto";

function loadEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i);
    let value = line.slice(i + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { status: res.status, data };
}

const envPath = ".env.whop.smoke";
if (!existsSync(envPath)) {
  console.error("Missing .env.whop.smoke — pull WHOP_* from Vercel first.");
  process.exit(1);
}

const env = loadEnvFile(envPath);
const key = env.WHOP_API_KEY;
const secret = env.WHOP_WEBHOOK_SECRET;

try {
  unlinkSync(envPath);
} catch {
  /* ignore */
}

if (!key || key === "[SENSITIVE]") {
  console.log(JSON.stringify({ ok: false, step: "env", error: "WHOP_API_KEY missing" }));
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  "Api-Version-Date": "2026-10-06",
};

const me = await getJson("https://api.whop.com/api/v1/accounts/me", { headers });
console.log(
  JSON.stringify({
    step: "accounts.me",
    status: me.status,
    id: me.data?.id ?? null,
    title: me.data?.title ?? null,
    error: me.data?.error ?? null,
  }),
);

let companyId =
  typeof me.data?.id === "string" && me.data.id.startsWith("biz_")
    ? me.data.id
    : "";

if (!companyId) {
  const companies = await getJson("https://api.whop.com/api/v1/companies?first=5", {
    headers,
  });
  const rows = Array.isArray(companies.data?.data) ? companies.data.data : [];
  console.log(
    JSON.stringify({
      step: "companies",
      status: companies.status,
      error: companies.data?.error ?? null,
      sample: rows.slice(0, 2).map((x) => ({ id: x.id, title: x.title })),
    }),
  );
  if (typeof rows[0]?.id === "string" && rows[0].id.startsWith("biz_")) {
    companyId = rows[0].id;
  }
}

if (!companyId) {
  writeFileSync(
    ".whop-smoke-result.json",
    JSON.stringify({ ok: false, reason: "no_company_id", meStatus: me.status }, null, 2),
  );
  process.exit(2);
}

const body = {
  mode: "payment",
  plan: {
    company_id: companyId,
    currency: "usd",
    initial_price: 1.13,
    plan_type: "one_time",
    title: "Ads Holistic smoke test",
    visibility: "hidden",
    product: {
      external_identifier: "adsholistic-wallet-topup",
      title: "Recarga Ads Holistic",
      description: "Saldo de cartera Ads Holistic",
      visibility: "hidden",
    },
  },
  redirect_url:
    "https://www.adsholistic.com/payments?tab=wallet-tx&status=whop_return",
  metadata: {
    payment_intent_id: "00000000-0000-4000-8000-000000000001",
    organization_id: "smoke-org",
    wallet_id: "smoke-wallet",
    smoke_test: "true",
  },
};

const checkout = await getJson(
  "https://api.whop.com/api/v1/checkout_configurations",
  {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "Idempotency-Key": `smoke-whop-${Date.now()}`,
    },
    body: JSON.stringify(body),
  },
);

const purchase = checkout.data?.purchase_url ?? null;
const checkoutId = checkout.data?.id ?? null;
console.log(
  JSON.stringify({
    step: "checkout_configurations",
    status: checkout.status,
    checkoutId,
    hasPurchaseUrl: Boolean(purchase),
    purchaseUrlPrefix: typeof purchase === "string" ? purchase.slice(0, 64) : null,
    error: checkout.data?.error ?? null,
  }),
);

const raw = JSON.stringify({
  id: "msg_smoke",
  type: "payment.succeeded",
  data: {
    id: "pay_smoke",
    usd_total: 1.13,
    currency: "usd",
    metadata: { payment_intent_id: "00000000-0000-4000-8000-000000000001" },
  },
});
const ts = String(Math.floor(Date.now() / 1000));
const id = "msg_smoke";
const sig = createHmac("sha256", secret || "")
  .update(`${id}.${ts}.${raw}`, "utf8")
  .digest("base64");
console.log(
  JSON.stringify({
    step: "webhook_secret_local",
    ok: Boolean(secret?.startsWith("ws_")) && Boolean(sig),
  }),
);

const ok =
  checkout.status >= 200 &&
  checkout.status < 300 &&
  Boolean(checkoutId && purchase);

writeFileSync(
  ".whop-smoke-result.json",
  JSON.stringify(
    {
      ok,
      companyId,
      checkoutStatus: checkout.status,
      checkoutId,
      hasPurchaseUrl: Boolean(purchase),
      meStatus: me.status,
      error: checkout.data?.error ?? me.data?.error ?? null,
    },
    null,
    2,
  ),
);

process.exit(ok ? 0 : 3);
