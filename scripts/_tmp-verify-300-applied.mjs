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
const AD_ACCOUNT_ID = "4373dc12-fa21-4e92-8b87-6070ea1aded1";
const JOURNAL_ID = "d80894d6-9220-412e-97f2-b244e0e16c77";

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// 1) TikTok live
const url = new URL(`${API}/advertiser/balance/get/`);
url.searchParams.set("bc_id", BC10);
url.searchParams.set("filtering", JSON.stringify({ keyword: ADV_15 }));
const tt = await (await fetch(url, { headers: { "Access-Token": TOKEN } })).json();
const row = (tt.data?.advertiser_account_list ?? [])[0];
console.log("=== TIKTOK 15.0 LIVE ===");
console.log(JSON.stringify({
  status: row?.advertiser_status,
  budget: row?.budget,
  cost: row?.budget_cost,
  remaining: row ? Number(row.budget) - Number(row.budget_cost) : null,
  cash_balance: row?.cash_balance,
  account_balance: row?.account_balance,
  transferable: row?.transferable_amount,
  portfolio: row?.payment_portfolio_type,
}, null, 2));

// 2) Wallet
const { data: wallet } = await admin
  .from("v_wallet_ledger_balances")
  .select("*")
  .eq("organization_id", ORG)
  .maybeSingle();
console.log("\n=== WALLET ===");
console.log(JSON.stringify({
  available: Number(wallet?.available_balance_cents ?? 0) / 100,
  raw: wallet,
}, null, 2));

// 3) Journal of our allocation
const { data: journal } = await admin
  .from("ledger_journals")
  .select("*")
  .eq("id", JOURNAL_ID)
  .maybeSingle();
console.log("\n=== JOURNAL ===");
console.log(JSON.stringify(journal, null, 2));

// 4) Ad account ledger balance (what UI might show as Saldo)
const { data: aaBal } = await admin
  .from("v_ad_account_ledger_balances")
  .select("*")
  .eq("ad_account_id", AD_ACCOUNT_ID)
  .maybeSingle();
console.log("\n=== AD ACCOUNT LEDGER BALANCE (UI Saldo?) ===");
console.log(JSON.stringify(aaBal, null, 2));

// fallback views
const { data: aaBal2 } = await admin
  .from("ad_account_balances")
  .select("*")
  .eq("ad_account_id", AD_ACCOUNT_ID)
  .maybeSingle();
console.log("ad_account_balances:", aaBal2);

// 5) Recent journals for this org related to allocate
const { data: recent } = await admin
  .from("ledger_journals")
  .select("id, description, created_at, metadata")
  .eq("organization_id", ORG)
  .order("created_at", { ascending: false })
  .limit(5);
console.log("\n=== RECENT JOURNALS ===");
for (const j of recent || []) {
  console.log(JSON.stringify({
    id: j.id,
    desc: j.description,
    at: j.created_at,
    meta: j.metadata,
  }));
}
