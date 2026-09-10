/**
 * One-shot: BM10/30 Ads Holistic clients → budget = cost + Holistic ledger.
 * Skips Hecom-only / agency accounts (no user link + no Holistic payments).
 *
 *   node scripts/cap-ads-holistic-shared-budgets.mjs           # dry-run
 *   node scripts/cap-ads-holistic-shared-budgets.mjs --commit  # apply
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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
  )
    v = v.slice(1, -1);
  env[t.slice(0, i).trim()] = v;
}

const COMMIT = process.argv.includes("--commit");
const TOKEN = env.TIKTOK_ACCESS_TOKEN?.trim();
const API = "https://business-api.tiktok.com/open_api/v1.3";
const BCS = {
  "10": "7652451146933698576",
  "30": "7564426417577148433",
};

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function n(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
function usd(c) {
  return Math.round(n(c)) / 100;
}
function round2(x) {
  return Math.round(n(x) * 100) / 100;
}

async function fetchAll(table, select) {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from(table)
      .select(select)
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

console.log(COMMIT ? "MODE: COMMIT" : "MODE: DRY-RUN");

const { data: links } = await admin
  .from("hecom_cliente_user_links")
  .select("hecom_cliente_id");
const linkSet = new Set(
  (links ?? []).map((r) => String(r.hecom_cliente_id)).filter(Boolean),
);

const { data: pis } = await admin
  .from("payment_intents")
  .select("metadata")
  .eq("status", "succeeded")
  .not("metadata->>hecom_cliente_id", "is", null)
  .limit(5000);
const piSet = new Set();
for (const p of pis ?? []) {
  const id = p.metadata?.hecom_cliente_id;
  if (id) piSet.add(String(id));
}

function isAdsHolistic(hecomId) {
  if (!hecomId) return false;
  return linkSet.has(hecomId) || piSet.has(hecomId);
}

const ads = (await fetchAll(
  "ad_accounts",
  "id,name,organization_id,external_account_id,external_business_id,metadata,platform,status",
)).filter((a) => a.platform === "tiktok" && a.external_account_id);

const bals = await fetchAll(
  "v_ad_account_ledger_balances",
  "ad_account_id,available_balance_cents",
);
const balByAd = new Map(bals.map((b) => [b.ad_account_id, usd(b.available_balance_cents)]));

const byAdv = new Map();
for (const a of ads) {
  const adv = String(a.external_account_id);
  const list = byAdv.get(adv) ?? [];
  list.push(a);
  byAdv.set(adv, list);
}

function bestLedger(adv) {
  let max = 0;
  let bestOrg = null;
  let bestAd = null;
  let hecomId = null;
  let name = null;
  for (const r of byAdv.get(adv) ?? []) {
    const led = balByAd.get(r.id) ?? 0;
    if (led >= max) {
      max = led;
      bestOrg = r.organization_id;
      bestAd = r.id;
    }
    if (r.metadata?.hecom_cliente_id) {
      hecomId = String(r.metadata.hecom_cliente_id);
      name = r.metadata.hecom_cliente_name || r.name;
    }
  }
  return { ledger: max, org: bestOrg, adId: bestAd, hecomId, name };
}

async function scanBc(bcId, label) {
  const out = [];
  for (let page = 1; page <= 40; page++) {
    const url = `${API}/advertiser/balance/get/?bc_id=${bcId}&page=${page}&page_size=50`;
    const json = await (
      await fetch(url, { headers: { "Access-Token": TOKEN } })
    ).json();
    if (json.code !== 0) throw new Error(`BM${label}: ${json.message}`);
    for (const r of json.data?.advertiser_account_list ?? []) {
      out.push({
        bm: label,
        bcId,
        advertiserId: String(r.advertiser_id),
        name: String(r.advertiser_name || ""),
        status: String(r.advertiser_status || ""),
        budget: n(r.budget),
        cost: n(r.budget_cost),
        mode: String(r.budget_mode || ""),
        portfolio: String(r.payment_portfolio_type || ""),
      });
    }
    const total = json.data?.page_info?.total_number ?? 0;
    if (page * 50 >= total) break;
  }
  return out;
}

async function setBudgetAbsolute(bcId, advertiserId, budgetUsd) {
  const body = {
    bc_id: bcId,
    budget_update_type: "UPDATE",
    advertiser_budgets: [
      {
        advertiser_id: advertiserId,
        budget: budgetUsd,
        budget_mode: "CUSTOM_BUDGET",
      },
    ],
  };
  const res = await fetch(`${API}/advertiser/update/`, {
    method: "POST",
    headers: {
      "Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

const tiktok = [];
for (const [label, bc] of Object.entries(BCS)) {
  const rows = await scanBc(bc, label);
  console.log(`BM${label}: ${rows.length}`);
  tiktok.push(...rows);
}

const TOL = 1;
const actions = [];
let skippedNotHolistic = 0;
let alreadyOk = 0;

for (const t of tiktok) {
  const hol = bestLedger(t.advertiserId);
  if (!isAdsHolistic(hol.hecomId)) {
    skippedNotHolistic += 1;
    continue;
  }
  const remaining = round2(t.budget - t.cost);
  const target = round2(Math.max(t.cost, t.cost + hol.ledger));
  const targetRemain = round2(target - t.cost);
  const gap = round2(remaining - hol.ledger); // >0 too much TikTok; <0 short vs ledger
  const unlimited = t.mode === "UNLIMITED";
  const needsLower = unlimited || gap > TOL;
  const needsRaise = !unlimited && gap < -TOL && hol.ledger > 0;
  if (!needsLower && !needsRaise) {
    alreadyOk += 1;
    continue;
  }
  actions.push({
    cliente: hol.name || hol.hecomId,
    hecomId: hol.hecomId,
    name: t.name,
    adv: t.advertiserId,
    bm: t.bm,
    bcId: t.bcId,
    cost: round2(t.cost),
    budgetBefore: round2(t.budget),
    remainBefore: remaining,
    ledger: hol.ledger,
    targetBudget: target,
    targetRemain,
    gap,
    unlimited,
    action: needsLower ? "lower" : "raise",
    org: hol.org,
  });
}

actions.sort((a, b) => b.gap - a.gap);

console.log("\nAds Holistic linked clientes:", linkSet.size);
console.log("With succeeded Holistic PI:", piSet.size);
console.log("Skipped not Ads Holistic accounts:", skippedNotHolistic);
console.log("Already OK:", alreadyOk);
console.log("Need cap:", actions.length);
console.log(
  "Headroom to remove $",
  round2(actions.reduce((s, a) => s + Math.max(0, a.gap), 0)),
);

for (const a of actions) {
  console.log(
    [
      a.action === "raise" ? "RAISE" : "LOWER",
      `BM${a.bm}`,
      String(a.cliente).slice(0, 22).padEnd(22),
      a.name.slice(0, 32).padEnd(32),
      `rem$${a.remainBefore}`.padStart(10),
      `led$${a.ledger}`.padStart(9),
      `→$${a.targetRemain}`.padStart(8),
      a.unlimited ? "UNLIM" : "",
    ].join(" | "),
  );
}

if (!COMMIT) {
  console.log("\nDry-run only. Re-run with --commit to apply.");
  process.exit(0);
}

console.log("\nApplying caps...");
let ok = 0;
let fail = 0;
for (const a of actions) {
  const json = await setBudgetAbsolute(a.bcId, a.adv, a.targetBudget);
  if (json.code === 0) {
    ok += 1;
    console.log("OK", a.name, `budget→${a.targetBudget}`);
  } else {
    fail += 1;
    console.log("FAIL", a.name, json.code, json.message);
  }
  await new Promise((r) => setTimeout(r, 250));
}
console.log({ ok, fail });
