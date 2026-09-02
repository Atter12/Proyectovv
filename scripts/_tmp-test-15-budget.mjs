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
const BC10 = "7652451146933698576";
const ADV_15 = "7660967142329843732";

async function getSnapshot() {
  const url = new URL(`${API}/advertiser/balance/get/`);
  url.searchParams.set("bc_id", BC10);
  url.searchParams.set("filtering", JSON.stringify({ keyword: ADV_15 }));
  const res = await fetch(url, { headers: { "Access-Token": TOKEN } });
  const json = await res.json();
  const row = (json.data?.advertiser_account_list ?? [])[0];
  return { code: json.code, message: json.message, row };
}

async function getBcBalance() {
  const res = await fetch(`${API}/bc/balance/get/?bc_id=${BC10}`, {
    headers: { "Access-Token": TOKEN },
  });
  return res.json();
}

const before = await getSnapshot();
const bcBal = await getBcBalance();

console.log("BEFORE", JSON.stringify(before, null, 2));
console.log("BM10_BALANCE", JSON.stringify(bcBal.data ?? bcBal, null, 2));

// Dry-run: try +$1 budget increase (real API call — revert manually if succeeds)
const increase = 1;
const body = {
  bc_id: BC10,
  budget_update_type: "INCREMENTAL_UPDATE",
  advertiser_budgets: [
    {
      advertiser_id: ADV_15,
      budget: increase,
      budget_mode: before.row?.budget_mode || "CUSTOM_BUDGET",
    },
  ],
};

const res = await fetch(`${API}/advertiser/update/`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
  body: JSON.stringify(body),
});
const result = await res.json();
console.log("BUDGET_INCREASE_TEST", JSON.stringify({ code: result.code, message: result.message, log_id: result.log_id }, null, 2));

if (result.code === 0) {
  const after = await getSnapshot();
  console.log("AFTER", JSON.stringify(after.row, null, 2));
  // revert -$1
  const revert = await fetch(`${API}/advertiser/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
    body: JSON.stringify({
      bc_id: BC10,
      budget_update_type: "INCREMENTAL_UPDATE",
      advertiser_budgets: [
        {
          advertiser_id: ADV_15,
          budget: -increase,
          budget_mode: before.row?.budget_mode || "CUSTOM_BUDGET",
        },
      ],
    }),
  });
  const revJson = await revert.json();
  console.log("REVERT", JSON.stringify({ code: revJson.code, message: revJson.message }));
}
