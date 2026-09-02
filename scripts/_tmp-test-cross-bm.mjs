import fs from "node:fs";

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
const ADV_15 = "7660967142329843732";
const BCS = {
  "10": "7652451146933698576",
  "30": "7564426417577148433",
  "200": "7575005779271614480",
};

async function bcBalance(bc) {
  const j = await (await fetch(`${API}/bc/balance/get/?bc_id=${bc}`, {
    headers: { "Access-Token": TOKEN },
  })).json();
  return j.data ?? j;
}

async function tryTransfer(bc, adv, amount, label) {
  const body = {
    bc_id: bc,
    advertiser_id: adv,
    transfer_type: "RECHARGE",
    cash_amount: amount,
    request_id: `test-${label}-${Date.now()}`,
  };
  const res = await fetch(`${API}/bc/transfer/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(`TRANSFER_TEST ${label}`, JSON.stringify({ code: json.code, message: json.message }));
  return json;
}

console.log("=== BM BALANCES ===");
for (const [k, bc] of Object.entries(BCS)) {
  const b = await bcBalance(bc);
  console.log(`BM${k}`, JSON.stringify({
    cash: b.valid_cash_balance ?? b.cash_balance,
    grant: b.valid_grant_balance ?? b.grant_balance,
    credit: b.valid_account_balance ?? b.account_balance,
    type: b.payment_portfolio_type,
  }));
}

// Test 1: BM200 cash -> adv 15.0 (wrong BC, account lives on BM10)
await tryTransfer(BCS["200"], ADV_15, 10, "bm200_to_15_wrong_bc");

// Test 2: BM10 cash transfer to 15.0 (BM10 has $0 cash)
await tryTransfer(BCS["10"], ADV_15, 10, "bm10_to_15_no_cash");

// Test 3: BM30 budget +$10 on 15.0 (account not on BM30)
const b30 = await fetch(`${API}/advertiser/update/`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
  body: JSON.stringify({
    bc_id: BCS["30"],
    budget_update_type: "INCREMENTAL_UPDATE",
    advertiser_budgets: [{ advertiser_id: ADV_15, budget: 10, budget_mode: "CUSTOM_BUDGET" }],
  }),
});
const b30j = await b30.json();
console.log("BUDGET_BM30_TO_15", JSON.stringify({ code: b30j.code, message: b30j.message }));

// Any approved account on BM200 we could use?
console.log("\n=== APPROVED ON BM200? ===");
for (let page = 1; page <= 3; page++) {
  const url = `${API}/advertiser/balance/get/?bc_id=${BCS["200"]}&page=${page}&page_size=50`;
  const json = await (await fetch(url, { headers: { "Access-Token": TOKEN } })).json();
  for (const r of json.data?.advertiser_account_list ?? []) {
    if (!/dominic|velame/i.test(String(r.advertiser_name))) continue;
    if (String(r.advertiser_status).includes("APPROVED")) {
      console.log(JSON.stringify({ id: r.advertiser_id, name: r.advertiser_name, cash: r.cash_balance }));
    }
  }
}

// BC payment transfer between BCs? probe endpoint
const bcTransferProbe = await fetch(`${API}/bc/transfer/`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
  body: JSON.stringify({
    bc_id: BCS["200"],
    partner_id: BCS["10"],
    transfer_type: "TRANSFER",
    cash_amount: 10,
    request_id: `bc-to-bc-probe-${Date.now()}`,
  }),
});
const probeJson = await bcTransferProbe.json();
console.log("BC_TO_BC_PROBE", JSON.stringify({ code: probeJson.code, message: probeJson.message }));
