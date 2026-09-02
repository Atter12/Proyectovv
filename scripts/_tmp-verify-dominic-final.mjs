import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[t.slice(0, i).trim()] = v;
}

const TOKEN = env.TIKTOK_ACCESS_TOKEN?.trim();
const API = "https://business-api.tiktok.com/open_api/v1.3";
const ORG = "7b67cc9a-b42e-4dcb-8d2f-4e3a47ba0f8a";
const BC10 = "7652451146933698576";
const ADV_15 = "7660967142329843732";
const BM = {
  "7652451146933698576": "10",
  "7564426417577148433": "30",
  "7575005779271614480": "200",
};

const vv = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function classify(st) {
  const s = String(st ?? "").toUpperCase();
  if (/SUSPEND|DISABLE|REJECT|PUNISH|BAN|CLOSE|LIMIT/.test(s)) return "banned";
  if (/APPROVE|ENABLE|ACTIVE|STATUS_OK/.test(s)) return "approved";
  return "other";
}

// 1) Scan all Dominic accounts
const all = [];
for (const [bc, bm] of Object.entries(BM)) {
  for (let page = 1; page <= 15; page++) {
    const url = `${API}/advertiser/balance/get/?bc_id=${bc}&page=${page}&page_size=50`;
    const res = await fetch(url, { headers: { "Access-Token": TOKEN } });
    const json = await res.json();
    if (json.code !== 0) {
      console.log("SCAN_ERR", bm, json.code, json.message);
      break;
    }
    const list = json.data?.advertiser_account_list ?? [];
    for (const row of list) {
      const n = String(row.advertiser_name || "");
      if (!/dominic|velame/i.test(n)) continue;
      all.push({
        bm,
        id: String(row.advertiser_id),
        name: n.trim(),
        status: row.advertiser_status,
        kind: classify(row.advertiser_status),
        budget: row.budget,
        cost: row.budget_cost,
        remaining: Math.round((Number(row.budget) - Number(row.budget_cost)) * 100) / 100,
      });
    }
    const total = json.data?.page_info?.total_number ?? 0;
    if (page * 50 >= total || list.length === 0) break;
  }
}

const approved = all.filter((r) => r.kind === "approved");
const banned = all.filter((r) => r.kind === "banned");
const checkTargets = ["30", "31", "224", "226", "227", "228", "15"];
const targetStatus = all.filter((r) =>
  checkTargets.some((t) => new RegExp(`\\b${t}(?:\\.0|\\b)`).test(r.name)),
);

console.log("=== TIKTOK SCAN ===");
console.log("total:", all.length, "approved:", approved.length, "banned:", banned.length);
console.log("\n--- APPROVED (recargables) ---");
for (const r of approved) console.log(JSON.stringify(r));
console.log("\n--- TARGET ACCOUNTS (30/31/224/15 etc) ---");
for (const r of targetStatus.sort((a, b) => a.name.localeCompare(b.name)))
  console.log(JSON.stringify(r));

// 2) Wallet balance
const { data: walletBal } = await vv
  .from("v_wallet_ledger_balances")
  .select("available_balance_cents, currency")
  .eq("organization_id", ORG)
  .maybeSingle();

const walletUsd =
  walletBal?.available_balance_cents != null
    ? Math.round(Number(walletBal.available_balance_cents) / 100)
    : null;

console.log("\n=== HOLISTIC WALLET ===");
console.log(JSON.stringify({ availableUsd: walletUsd, currency: walletBal?.currency ?? "USD" }));

// 3) Account 15.0 detail + BM10 balance
const snapUrl = new URL(`${API}/advertiser/balance/get/`);
snapUrl.searchParams.set("bc_id", BC10);
snapUrl.searchParams.set("filtering", JSON.stringify({ keyword: ADV_15 }));
const snapRes = await fetch(snapUrl, { headers: { "Access-Token": TOKEN } });
const snapJson = await snapRes.json();
const row15 = (snapJson.data?.advertiser_account_list ?? [])[0];

const bcRes = await fetch(`${API}/bc/balance/get/?bc_id=${BC10}`, {
  headers: { "Access-Token": TOKEN },
});
const bcJson = await bcRes.json();

console.log("\n=== ACCOUNT 15.0 NOW ===");
console.log(JSON.stringify({
  status: row15?.advertiser_status,
  budget: row15?.budget,
  cost: row15?.budget_cost,
  remaining: row15 ? Number(row15.budget) - Number(row15.budget_cost) : null,
  payment_type: row15?.payment_portfolio_type,
}));

console.log("\n=== BM10 BALANCE ===");
console.log(JSON.stringify({
  cash: bcJson.data?.cash_balance,
  credit: bcJson.data?.account_balance,
  type: bcJson.data?.payment_portfolio_type,
}));

// 4) Dry test +$1 on 15.0 (revert immediately)
const increase = 1;
const testRes = await fetch(`${API}/advertiser/update/`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
  body: JSON.stringify({
    bc_id: BC10,
    budget_update_type: "INCREMENTAL_UPDATE",
    advertiser_budgets: [{
      advertiser_id: ADV_15,
      budget: increase,
      budget_mode: row15?.budget_mode || "CUSTOM_BUDGET",
    }],
  }),
});
const testJson = await testRes.json();
let revertOk = null;
if (testJson.code === 0) {
  const rev = await fetch(`${API}/advertiser/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
    body: JSON.stringify({
      bc_id: BC10,
      budget_update_type: "INCREMENTAL_UPDATE",
      advertiser_budgets: [{
        advertiser_id: ADV_15,
        budget: -increase,
        budget_mode: row15?.budget_mode || "CUSTOM_BUDGET",
      }],
    }),
  });
  const revJson = await rev.json();
  revertOk = revJson.code === 0;
}

console.log("\n=== FUNDING TEST (+$1 revert) ===");
console.log(JSON.stringify({
  canIncreaseBudget: testJson.code === 0,
  tiktokCode: testJson.code,
  tiktokMessage: testJson.message,
  revertOk,
}));

console.log("\n=== VERDICT ===");
const canSendMessage =
  approved.length === 1 &&
  approved[0].id === ADV_15 &&
  banned.some((r) => /30\.00|31\.00|224\.00/.test(r.name)) &&
  testJson.code === 0 &&
  walletUsd != null &&
  walletUsd >= 300;

console.log(JSON.stringify({
  messageSafeToSend: canSendMessage,
  onlyActiveIs15: approved.length === 1 && approved[0].id === ADV_15,
  walletHas300Plus: walletUsd != null && walletUsd >= 300,
  fundingApiWorks: testJson.code === 0,
  walletUsdApprox: walletUsd,
  approvedAccounts: approved.map((a) => a.name),
}));
