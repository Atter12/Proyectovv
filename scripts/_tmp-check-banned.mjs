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

const targets = ["30", "31", "224", "226", "227", "228"];

const { data: accounts } = await vv
  .from("ad_accounts")
  .select("id,name,status,external_account_id,external_business_id")
  .eq("organization_id", ORG)
  .eq("status", "active");

const picked = (accounts || []).filter((a) =>
  targets.some((t) => new RegExp(`\\b${t.replace(".", "\\.")}\\b`).test(a.name)),
);

async function tiktokStatus(advId, bcId) {
  if (!TOKEN || !advId || !bcId) return null;
  const url = new URL(`${API}/advertiser/balance/get/`);
  url.searchParams.set("bc_id", bcId);
  url.searchParams.set("filtering", JSON.stringify({ keyword: advId }));
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "20");
  const res = await fetch(url, { headers: { "Access-Token": TOKEN } });
  const json = await res.json();
  const row = (json.data?.advertiser_account_list ?? []).find(
    (r) => String(r.advertiser_id) === advId,
  );
  return row
    ? {
        status: row.advertiser_status,
        budget: row.budget,
        cost: row.budget_cost,
      }
    : { status: "NOT_IN_BC", code: json.code, msg: json.message };
}

for (const a of picked) {
  const bc = a.external_business_id?.trim() || "";
  const bm = BM[bc] || bc || "?";
  const tt = await tiktokStatus(a.external_account_id, bc || "7564426417577148433");
  // try alt BC if not found
  let ttFinal = tt;
  if (tt?.status === "NOT_IN_BC") {
    for (const alt of Object.keys(BM)) {
      if (alt === bc) continue;
      const tryAlt = await tiktokStatus(a.external_account_id, alt);
      if (tryAlt && tryAlt.status !== "NOT_IN_BC") {
        ttFinal = { ...tryAlt, foundOn: `BM ${BM[alt]}` };
        break;
      }
    }
  }
  console.log(
    JSON.stringify({
      name: a.name,
      holistic: a.status,
      bm,
      adv: a.external_account_id,
      tiktok: ttFinal,
    }),
  );
}

// any active + fundable BM30/200 not punished?
console.log("\n--- scan bm30/200 dominic ---");
for (const [bc, label] of Object.entries(BM)) {
  if (label === "10") continue;
  for (let page = 1; page <= 8; page++) {
    const url = `${API}/advertiser/balance/get/?bc_id=${bc}&page=${page}&page_size=50`;
    const res = await fetch(url, { headers: { "Access-Token": TOKEN } });
    const json = await res.json();
    const list = json.data?.advertiser_account_list ?? [];
    for (const row of list) {
      const n = String(row.advertiser_name || "");
      if (!/dominic|velame/i.test(n)) continue;
      const st = String(row.advertiser_status || "");
      if (
        st.includes("APPROVED") &&
        !st.includes("PUNISHED") &&
        !st.includes("SUSPEND")
      ) {
        console.log(
          JSON.stringify({
            bm: label,
            id: row.advertiser_id,
            name: n,
            status: st,
            budget: row.budget,
            cost: row.budget_cost,
          }),
        );
      }
    }
    const total = json.data?.page_info?.total_number ?? 0;
    if (page * 50 >= total || list.length === 0) break;
  }
}
