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
const IDS = [
  ["7678381912075010066", "1011_23"],
  ["7679865891437428744", "1011_28"],
  ["7679869482201923605", "1011_29"],
  ["7679869635402973204", "1011_40"],
  ["7660967142329843732", "15.0"],
];
const BCS = {
  "7652451146933698576": "10",
  "7564426417577148433": "30",
  "7575005779271614480": "200",
};

for (const [adv, label] of IDS) {
  for (const [bc, bm] of Object.entries(BCS)) {
    const url = new URL(`${API}/advertiser/balance/get/`);
    url.searchParams.set("bc_id", bc);
    url.searchParams.set("filtering", JSON.stringify({ keyword: adv }));
    const res = await fetch(url, { headers: { "Access-Token": TOKEN } });
    const json = await res.json();
    const row = (json.data?.advertiser_account_list ?? []).find((r) => String(r.advertiser_id) === adv);
    if (row) {
      console.log(JSON.stringify({ label, bm, id: adv, name: row.advertiser_name, status: row.advertiser_status, budget: row.budget, cost: row.budget_cost }));
    }
  }
}

// BM balances
for (const [bc, bm] of Object.entries(BCS)) {
  const url = `${API}/bc/balance/get/?bc_id=${bc}`;
  const res = await fetch(url, { headers: { "Access-Token": TOKEN } });
  const json = await res.json();
  const d = json.data ?? {};
  console.log("BM", bm, JSON.stringify({ cash: d.cash_balance, grant: d.grant_balance, credit: d.account_balance, type: d.payment_portfolio_type }));
}
