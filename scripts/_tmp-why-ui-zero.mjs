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

const ADV_15 = "7660967142329843732";
const ORG = "7b67cc9a-b42e-4dcb-8d2f-4e3a47ba0f8a";

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// All rows that look like 15.0 or share advertiser id
const { data: byAdv } = await admin
  .from("ad_accounts")
  .select("id,organization_id,name,status,external_account_id,external_business_id,updated_at,created_at")
  .eq("external_account_id", ADV_15);

const { data: byName } = await admin
  .from("ad_accounts")
  .select("id,organization_id,name,status,external_account_id,external_business_id")
  .ilike("name", "%15.0%");

console.log("BY_ADV_ID", byAdv);
console.log("BY_NAME", byName);

for (const row of byAdv || []) {
  const { data: bal } = await admin
    .from("v_ad_account_ledger_balances")
    .select("available_balance_cents")
    .eq("ad_account_id", row.id)
    .maybeSingle();
  const { data: legacy } = await admin
    .from("ad_account_balances")
    .select("balance_cents")
    .eq("ad_account_id", row.id)
    .maybeSingle();
  console.log("BALANCE", row.id, row.organization_id, {
    ledger: bal?.available_balance_cents,
    legacy: legacy?.balance_cents,
  });
}

// 28/29 also shown as $0
const { data: ones } = await admin
  .from("ad_accounts")
  .select("id,name,status,external_account_id,organization_id")
  .eq("organization_id", ORG)
  .or("name.ilike.%28.0%,name.ilike.%29.0%,name.ilike.%15.0%");

console.log("\nORG ACCOUNTS 15/28/29");
for (const a of ones || []) {
  const { data: bal } = await admin
    .from("v_ad_account_ledger_balances")
    .select("available_balance_cents")
    .eq("ad_account_id", a.id)
    .maybeSingle();
  console.log(a.name, a.id, a.status, "holistic$", (bal?.available_balance_cents ?? 0) / 100);
}
