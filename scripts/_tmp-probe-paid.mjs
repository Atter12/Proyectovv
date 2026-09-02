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
const BC10 = "7652451146933698576";
const BC30 = "7564426417577148433";

async function post(body, label) {
  const res = await fetch(`${API}/bc/transfer/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(label, JSON.stringify({ code: json.code, message: json.message }));
  return json;
}

// paId variants
await post({
  bc_id: BC10, advertiser_id: ADV_15, transfer_type: "RECHARGE",
  amount_info: { credit_amount: 10 }, paId: PORTFOLIO,
  request_id: `pa1-${Date.now()}`,
}, "paId_credit");

await post({
  bc_id: BC10, advertiser_id: ADV_15, transfer_type: "RECHARGE",
  payment_portfolio_id: PORTFOLIO, cash_amount: 10,
  request_id: `pa2-${Date.now()}`,
}, "portfolio_id_cash");

await post({
  bc_id: BC10, advertiser_id: ADV_15, transfer_type: "RECHARGE",
  payment_portfolio_id: PORTFOLIO,
  amount_info: { credit_amount: 10, cash_amount: 0, grant_amount: 0 },
  request_id: `pa3-${Date.now()}`,
}, "portfolio_amount_info_credit");

await post({
  bc_id: BC10, advertiser_id: ADV_15, transfer_type: "RECHARGE",
  grant_amount: 10, request_id: `grant10-${Date.now()}`,
}, "grant_bm10");

await post({
  bc_id: BC30, advertiser_id: ADV_15, transfer_type: "RECHARGE",
  grant_amount: 10, request_id: `grant30b-${Date.now()}`,
}, "grant_bm30_wrong_adv");

// List BC info / finance role
const bcGet = await (await fetch(`${API}/bc/get/?bc_id=${BC10}`, {
  headers: { "Access-Token": TOKEN },
})).json();
console.log("BC10_INFO", JSON.stringify({ code: bcGet.code, message: bcGet.message, role: bcGet.data?.list?.[0] ?? bcGet.data }));

const bcMember = await (await fetch(`${API}/bc/member/get/?bc_id=${BC10}&page=1&page_size=5`, {
  headers: { "Access-Token": TOKEN },
})).json();
console.log("BC10_MEMBERS", JSON.stringify({ code: bcMember.code, message: bcMember.message }));

// min transferable on adv 15
const bal = await (await fetch(`${API}/advertiser/balance/get/?bc_id=${BC10}&filtering=${encodeURIComponent(JSON.stringify({ keyword: ADV_15 }))}`, {
  headers: { "Access-Token": TOKEN },
})).json();
const row = (bal.data?.advertiser_account_list ?? [])[0];
console.log("ADV15_EXTRA", JSON.stringify({
  min_transferable: row?.min_transferable_amount,
  transferable: row?.transferable_amount,
  balance_reminder: row?.balance_reminder,
  portfolio_id: row?.payment_portfolio_id,
}));
