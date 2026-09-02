import fs from "node:fs";
import { randomUUID } from "node:crypto";
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
const AMOUNT_USD = 300;
const AMOUNT_CENTS = AMOUNT_USD * 100;

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function snap() {
  const url = new URL(`${API}/advertiser/balance/get/`);
  url.searchParams.set("bc_id", BC10);
  url.searchParams.set("filtering", JSON.stringify({ keyword: ADV_15 }));
  const json = await (await fetch(url, { headers: { "Access-Token": TOKEN } })).json();
  return (json.data?.advertiser_account_list ?? [])[0];
}

const before = await snap();
console.log("TIKTOK_BEFORE", { budget: before?.budget, cost: before?.budget_cost });

const newBudget = Math.max(0, Number(before?.budget) - AMOUNT_USD);
const decRes = await fetch(`${API}/advertiser/update/`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
  body: JSON.stringify({
    bc_id: BC10,
    budget_update_type: "UPDATE",
    advertiser_budgets: [{
      advertiser_id: ADV_15,
      budget: newBudget,
      budget_mode: before?.budget_mode || "CUSTOM_BUDGET",
    }],
  }),
});
const decJson = await decRes.json();
console.log("TIKTOK_DECREASE", { code: decJson.code, message: decJson.message, newBudget });
if (decJson.code !== 0) throw new Error(`TikTok decrease failed: ${decJson.message}`);

const idempotencyKey = `dominic-15-reclaim-300:${new Date().toISOString().slice(0, 10)}:${randomUUID()}`;
const { data: journalId, error: ledgerErr } = await admin.rpc(
  "ledger_refund_from_ad_account_to_wallet",
  {
    p_ad_account_id: AD_ACCOUNT_ID,
    p_amount_cents: AMOUNT_CENTS,
    p_source_balance: "available",
    p_idempotency_key: idempotencyKey,
    p_description: "Devolución $300 a cartera — BM10 sin saldo gastable",
    p_metadata: {
      source: "ops_script",
      reason: "bm10_no_spendable_balance",
      tiktok_budget_before: before?.budget,
      tiktok_budget_after: newBudget,
      tiktok_advertiser_id: ADV_15,
    },
  },
);

if (ledgerErr) throw new Error(ledgerErr.message);

const after = await snap();
const { data: wallet } = await admin
  .from("v_wallet_ledger_balances")
  .select("available_balance_cents")
  .eq("organization_id", ORG)
  .maybeSingle();
const { data: aaBal } = await admin
  .from("v_ad_account_ledger_balances")
  .select("available_balance_cents")
  .eq("ad_account_id", AD_ACCOUNT_ID)
  .maybeSingle();

console.log("\n=== RECLAIM OK ===");
console.log(JSON.stringify({
  journalId: String(journalId),
  tiktokBudget: { before: before?.budget, after: after?.budget },
  walletUsd: Number(wallet?.available_balance_cents ?? 0) / 100,
  adAccountLedgerUsd: Number(aaBal?.available_balance_cents ?? 0) / 100,
}, null, 2));
