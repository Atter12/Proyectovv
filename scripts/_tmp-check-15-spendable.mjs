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
const BC10 = "7652451146933698576";
const ADV_15 = "7660967142329843732";
const ORG = "7b67cc9a-b42e-4dcb-8d2f-4e3a47ba0f8a";

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function getAdv(bc, adv) {
  const url = new URL(`${API}/advertiser/balance/get/`);
  url.searchParams.set("bc_id", bc);
  url.searchParams.set("filtering", JSON.stringify({ keyword: adv }));
  const json = await (await fetch(url, { headers: { "Access-Token": TOKEN } })).json();
  return (json.data?.advertiser_account_list ?? [])[0] ?? null;
}

async function getBc(bc) {
  const json = await (await fetch(`${API}/bc/balance/get/?bc_id=${bc}`, {
    headers: { "Access-Token": TOKEN },
  })).json();
  return json.data ?? json;
}

const row = await getAdv(BC10, ADV_15);
const bc = await getBc(BC10);

console.log("=== ACCOUNT 15.0 NOW ===");
console.log(JSON.stringify({
  name: row?.advertiser_name,
  status: row?.advertiser_status,
  budget: row?.budget,
  budget_cost: row?.budget_cost,
  remaining_budget: row ? Number(row.budget) - Number(row.budget_cost) : null,
  budget_mode: row?.budget_mode,
  cash_balance: row?.cash_balance,
  valid_cash_balance: row?.valid_cash_balance,
  account_balance: row?.account_balance,
  valid_account_balance: row?.valid_account_balance,
  grant_balance: row?.grant_balance,
  transferable_amount: row?.transferable_amount,
  frozen_balance: row?.frozen_balance,
  payment_portfolio_type: row?.payment_portfolio_type,
  payment_portfolio_name: row?.payment_portfolio_name,
  balance_reminder: row?.balance_reminder,
}, null, 2));

console.log("\n=== BM10 NOW ===");
console.log(JSON.stringify({
  cash: bc.cash_balance,
  valid_cash: bc.valid_cash_balance,
  credit: bc.account_balance,
  valid_credit: bc.valid_account_balance,
  grant: bc.grant_balance,
  type: bc.payment_portfolio_type,
}, null, 2));

// Check if campaigns might be on different advertiser - list all approved dominic on bm10
console.log("\n=== ALL DOMINIC BM10 ===");
for (let page = 1; page <= 5; page++) {
  const url = `${API}/advertiser/balance/get/?bc_id=${BC10}&page=${page}&page_size=50`;
  const json = await (await fetch(url, { headers: { "Access-Token": TOKEN } })).json();
  const list = json.data?.advertiser_account_list ?? [];
  for (const r of list) {
    if (!/dominic|velame/i.test(String(r.advertiser_name))) continue;
    const approved = String(r.advertiser_status).includes("APPROVED");
    console.log(JSON.stringify({
      id: r.advertiser_id,
      name: r.advertiser_name,
      status: r.advertiser_status,
      budget: r.budget,
      cost: r.budget_cost,
      remaining: Number(r.budget) - Number(r.budget_cost),
      cash: r.cash_balance,
      acct_bal: r.account_balance,
      approved,
    }));
  }
  const total = json.data?.page_info?.total_number ?? 0;
  if (page * 50 >= total || list.length === 0) break;
}

// Holistic ledger
const { data: acc } = await admin
  .from("ad_accounts")
  .select("id")
  .eq("organization_id", ORG)
  .eq("external_account_id", ADV_15)
  .maybeSingle();
const { data: bal } = await admin
  .from("v_ad_account_ledger_balances")
  .select("available_balance_cents")
  .eq("ad_account_id", acc?.id)
  .maybeSingle();
const { data: wallet } = await admin
  .from("v_wallet_ledger_balances")
  .select("available_balance_cents")
  .eq("organization_id", ORG)
  .maybeSingle();

console.log("\n=== HOLISTIC ===");
console.log(JSON.stringify({
  adAccountLedgerUsd: Number(bal?.available_balance_cents ?? 0) / 100,
  walletUsd: Number(wallet?.available_balance_cents ?? 0) / 100,
}, null, 2));

// Diagnosis
const remaining = row ? Number(row.budget) - Number(row.budget_cost) : 0;
const canSpendTikTok = remaining > 0 && String(row?.advertiser_status).includes("APPROVED");
const hasBcCredit = Number(bc.valid_account_balance ?? bc.account_balance ?? 0) > 0;
const hasCash = Number(bc.valid_cash_balance ?? bc.cash_balance ?? 0) > 0;

console.log("\n=== DIAGNOSIS ===");
console.log(JSON.stringify({
  budgetWasIncreased: Number(row?.budget) >= 800,
  remainingToSpend: remaining,
  tikTokSaysCanSpend: canSpendTikTok,
  bm10HasCredit: hasBcCredit,
  bm10HasCash: hasCash,
  likelyIssue: !hasBcCredit && !hasCash
    ? "BM10 sin línea de crédito/cash — subir presupuesto no da balance real para pautar"
    : remaining <= 0
      ? "Presupuesto agotado"
      : "Debería poder gastar — revisar si campañas tienen budget propio en 0",
}, null, 2));
