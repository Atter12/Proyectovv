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
const PORTFOLIO = "7656754798154270000";
const BCS = { "10": "7652451146933698576", "30": "7564426417577148433", "200": "7575005779271614480" };

async function post(path, body, label) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(label, JSON.stringify({ code: json.code, message: json.message, data: json.data ?? null }));
  return json;
}

async function get(path, label) {
  const res = await fetch(`${API}${path}`, { headers: { "Access-Token": TOKEN } });
  const json = await res.json();
  console.log(label, JSON.stringify({ code: json.code, message: json.message, sample: json.data ? Object.keys(json.data) : null }));
  if (json.code === 0 && json.data) {
    const list = json.data.list ?? json.data.payment_portfolio_list ?? json.data.payment_portfolios;
    if (Array.isArray(list)) {
      for (const row of list.slice(0, 5)) console.log("  ", JSON.stringify(row));
    } else console.log("  data", JSON.stringify(json.data).slice(0, 800));
  }
  return json;
}

console.log("=== 1. PAYMENT PORTFOLIO GET ===");
await get("/payment_portfolio/get/?page=1&page_size=20", "portfolio_get");

console.log("\n=== 2. PORTFOLIO ADVERTISERS ===");
await get(`/payment_portfolio/advertiser/get/?payment_portfolio_id=${PORTFOLIO}&page=1&page_size=20`, "portfolio_adv");

console.log("\n=== 3. BC TRANSFER credit_amount -> ADV 15 ===");
await post("/bc/transfer/", {
  bc_id: BCS["10"],
  transfer_level: "ADVERTISER",
  advertiser_id: ADV_15,
  payment_portfolio_id: PORTFOLIO,
  transfer_type: "RECHARGE",
  amount_info: { credit_amount: 10 },
  request_id: `probe-credit-adv-${Date.now()}`,
}, "credit_to_adv_10");

console.log("\n=== 4. BC TRANSFER cash_amount -> ADV 15 + portfolio ===");
await post("/bc/transfer/", {
  bc_id: BCS["10"],
  transfer_level: "ADVERTISER",
  advertiser_id: ADV_15,
  payment_portfolio_id: PORTFOLIO,
  transfer_type: "RECHARGE",
  cash_amount: 10,
  request_id: `probe-cash-adv-${Date.now()}`,
}, "cash_to_adv_10");

console.log("\n=== 5. BC LEVEL RECHARGE BM10 credit ===");
await post("/bc/transfer/", {
  bc_id: BCS["10"],
  transfer_level: "BC",
  transfer_type: "RECHARGE",
  cash_amount: 10,
  request_id: `probe-bc-credit-${Date.now()}`.padEnd(32, "0").slice(0, 32),
}, "bc_level_recharge_10");

console.log("\n=== 6. BC LEVEL from BM30 -> BM10 via child_bc_id? ===");
await post("/bc/transfer/", {
  bc_id: BCS["30"],
  child_bc_id: BCS["10"],
  transfer_level: "BC",
  transfer_type: "RECHARGE",
  cash_amount: 10,
  request_id: `probe-bc30to10-${Date.now()}`.padEnd(32, "0").slice(0, 32),
}, "bc30_to_bc10_child");

console.log("\n=== 7. GRANT from BM30 -> ADV 15 (wrong bc) ===");
await post("/bc/transfer/", {
  bc_id: BCS["30"],
  transfer_level: "ADVERTISER",
  advertiser_id: ADV_15,
  transfer_type: "RECHARGE",
  grant_amount: 10,
  request_id: `probe-grant30-${Date.now()}`,
}, "grant30_to_15");

console.log("\n=== 8. CREDIT LINE UPDATE portfolio ===");
await post("/payment_portfolio/credit_line/update/", {
  payment_portfolio_id: PORTFOLIO,
  credit_amount: 300,
}, "credit_line_update");

await post("/payment_portfolio/credit_line/update/", {
  payment_portfolio_id: PORTFOLIO,
  amount: 300,
}, "credit_line_update_v2");

await post("/payment_portfolio/credit_line/update/", {
  payment_portfolio_id: PORTFOLIO,
  credit_line_amount: 300,
}, "credit_line_update_v3");

console.log("\n=== 9. BM200 cash + payment_portfolio to adv15 ===");
await post("/bc/transfer/", {
  bc_id: BCS["200"],
  transfer_level: "ADVERTISER",
  advertiser_id: ADV_15,
  transfer_type: "RECHARGE",
  cash_amount: 10,
  request_id: `probe-200cash-${Date.now()}`,
}, "bm200_cash_adv15");
