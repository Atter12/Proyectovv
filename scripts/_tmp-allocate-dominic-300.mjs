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
const AMOUNT_USD = 300;
const AMOUNT_CENTS = AMOUNT_USD * 100;

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// 1) Resolve Holistic ad account row
const { data: account, error: accErr } = await admin
  .from("ad_accounts")
  .select("id,name,status,external_account_id,external_business_id")
  .eq("organization_id", ORG)
  .eq("external_account_id", ADV_15)
  .maybeSingle();

if (accErr) throw new Error(accErr.message);
if (!account?.id) throw new Error("No se encontró ad_account 15.0 en Holistic");

console.log("ACCOUNT", account);

// 2) Wallet before
const { data: walletBefore } = await admin
  .from("v_wallet_ledger_balances")
  .select("available_balance_cents")
  .eq("organization_id", ORG)
  .maybeSingle();

console.log("WALLET_BEFORE", walletBefore?.available_balance_cents);

// 3) TikTok snapshot before
const snapUrl = new URL(`${API}/advertiser/balance/get/`);
snapUrl.searchParams.set("bc_id", BC10);
snapUrl.searchParams.set("filtering", JSON.stringify({ keyword: ADV_15 }));
const snapBefore = await (await fetch(snapUrl, { headers: { "Access-Token": TOKEN } })).json();
const rowBefore = (snapBefore.data?.advertiser_account_list ?? [])[0];
console.log("TIKTOK_BEFORE", { budget: rowBefore?.budget, cost: rowBefore?.budget_cost, status: rowBefore?.advertiser_status });

if (String(rowBefore?.advertiser_status) !== "SHOW_ACCOUNT_STATUS_APPROVED") {
  throw new Error(`Cuenta 15.0 no está APPROVED: ${rowBefore?.advertiser_status}`);
}

const idempotencyKey = `dominic-15-allocation-300:${new Date().toISOString().slice(0, 10)}:${randomUUID()}`;

// 4) TikTok budget +$300 FIRST (same as allocate-with-tiktok)
const increaseRes = await fetch(`${API}/advertiser/update/`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
  body: JSON.stringify({
    bc_id: BC10,
    budget_update_type: "INCREMENTAL_UPDATE",
    advertiser_budgets: [{
      advertiser_id: ADV_15,
      budget: AMOUNT_USD,
      budget_mode: rowBefore?.budget_mode || "CUSTOM_BUDGET",
    }],
  }),
});
const increaseJson = await increaseRes.json();
console.log("TIKTOK_INCREASE", { code: increaseJson.code, message: increaseJson.message, log_id: increaseJson.log_id });

if (increaseJson.code !== 0) {
  throw new Error(`TikTok budget increase failed: ${increaseJson.message}`);
}

// 5) Ledger allocate (deduct wallet)
const { data: journalId, error: ledgerErr } = await admin.rpc("ledger_allocate_to_ad_account", {
  p_ad_account_id: account.id,
  p_amount_cents: AMOUNT_CENTS,
  p_idempotency_key: idempotencyKey,
  p_description: "Asignación $300 a cuenta 15.0 — Dominic Velame",
  p_metadata: {
    source: "ops_script",
    tiktok_bc_id: BC10,
    tiktok_advertiser_id: ADV_15,
    tiktok_funding_source: "shared_budget",
    tiktok_budget_before: rowBefore?.budget,
    tiktok_budget_after: Number(rowBefore?.budget) + AMOUNT_USD,
    tiktok_amount_cents: AMOUNT_CENTS,
  },
});

if (ledgerErr) {
  console.error("LEDGER_FAILED — attempting revert TikTok -$300");
  const rev = await fetch(`${API}/advertiser/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
    body: JSON.stringify({
      bc_id: BC10,
      budget_update_type: "INCREMENTAL_UPDATE",
      advertiser_budgets: [{
        advertiser_id: ADV_15,
        budget: -AMOUNT_USD,
        budget_mode: rowBefore?.budget_mode || "CUSTOM_BUDGET",
      }],
    }),
  });
  const revJson = await rev.json();
  console.log("TIKTOK_REVERT", revJson);
  throw new Error(ledgerErr.message);
}

// 6) Verify after
const snapAfter = await (await fetch(snapUrl, { headers: { "Access-Token": TOKEN } })).json();
const rowAfter = (snapAfter.data?.advertiser_account_list ?? [])[0];
const { data: walletAfter } = await admin
  .from("v_wallet_ledger_balances")
  .select("available_balance_cents")
  .eq("organization_id", ORG)
  .maybeSingle();

console.log("\n=== SUCCESS ===");
console.log(JSON.stringify({
  journalId: String(journalId),
  adAccount: account.name,
  tiktokBudgetBefore: rowBefore?.budget,
  tiktokBudgetAfter: rowAfter?.budget,
  tiktokRemaining: Number(rowAfter?.budget) - Number(rowAfter?.budget_cost),
  walletBeforeUsd: Number(walletBefore?.available_balance_cents ?? 0) / 100,
  walletAfterUsd: Number(walletAfter?.available_balance_cents ?? 0) / 100,
  idempotencyKey,
}, null, 2));
