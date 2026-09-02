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

const TOKEN = env.TIKTOK_ACCESS_TOKEN?.trim();
const API = "https://business-api.tiktok.com/open_api/v1.3";
const ORG = "7b67cc9a-b42e-4dcb-8d2f-4e3a47ba0f8a";
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

async function scanBc(bc, label) {
  const rows = [];
  for (let page = 1; page <= 15; page++) {
    const url = `${API}/advertiser/balance/get/?bc_id=${bc}&page=${page}&page_size=50`;
    const res = await fetch(url, { headers: { "Access-Token": TOKEN } });
    const json = await res.json();
    if (json.code !== 0) {
      console.error("err", label, json.code, json.message);
      break;
    }
    const list = json.data?.advertiser_account_list ?? [];
    for (const row of list) {
      const n = String(row.advertiser_name || "");
      if (!/dominic|velame|1011/i.test(n)) continue;
      rows.push({
        bm: label,
        id: row.advertiser_id,
        name: n,
        status: row.advertiser_status,
        budget: row.budget,
        cost: row.budget_cost,
      });
    }
    const total = json.data?.page_info?.total_number ?? 0;
    if (page * 50 >= total || list.length === 0) break;
  }
  return rows;
}

const all = [];
for (const [bc, label] of Object.entries(BM)) {
  all.push(...(await scanBc(bc, label)));
}

const approved = all.filter(
  (r) =>
    String(r.status).includes("APPROVED") &&
    !String(r.status).includes("PUNISHED") &&
    !String(r.status).includes("SUSPEND"),
);

console.log("ALL DOMINIC ACCOUNTS ON TIKTOK:", all.length);
for (const r of all.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(JSON.stringify(r));
}
console.log("\nAPPROVED (fundable):", approved.length);
for (const r of approved) console.log(JSON.stringify(r));

const { data: holistic } = await vv
  .from("ad_accounts")
  .select("name,status,external_account_id,external_business_id")
  .eq("organization_id", ORG);

console.log("\nHOLISTIC active count:", (holistic || []).filter((a) => a.status === "active").length);
