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
const CLIENTE = "4c1b13ac-7287-4609-bd6d-51ee9b2739c4";
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

function classify(st) {
  const s = String(st ?? "").toUpperCase();
  if (/SUSPEND|DISABLE|REJECT|PUNISH|BAN|CLOSE|LIMIT/.test(s)) return "suspended";
  if (/APPROVE|ENABLE|ACTIVE|STATUS_OK/.test(s)) return "approved";
  return "unknown";
}

async function scanAll() {
  const byId = new Map();
  for (const [bc, label] of Object.entries(BM)) {
    for (let page = 1; page <= 15; page++) {
      const url = `${API}/advertiser/balance/get/?bc_id=${bc}&page=${page}&page_size=50`;
      const res = await fetch(url, { headers: { "Access-Token": TOKEN } });
      const json = await res.json();
      const list = json.data?.advertiser_account_list ?? [];
      for (const row of list) {
        const n = String(row.advertiser_name || "");
        if (!/dominic|velame/i.test(n)) continue;
        byId.set(String(row.advertiser_id), {
          name: n,
          status: row.advertiser_status,
          kind: classify(row.advertiser_status),
          bm: label,
          bc,
        });
      }
      const total = json.data?.page_info?.total_number ?? 0;
      if (page * 50 >= total || list.length === 0) break;
    }
  }
  return byId;
}

const tiktok = await scanAll();
const { data: accounts } = await vv
  .from("ad_accounts")
  .select("id,name,status,external_account_id")
  .eq("organization_id", ORG);

let disabled = 0;
let kept = 0;
for (const acc of accounts || []) {
  const adv = acc.external_account_id?.trim();
  if (!adv) continue;
  const live = tiktok.get(adv);
  if (!live) continue;
  const shouldDisable = live.kind === "suspended";
  const shouldActive = live.kind === "approved";
  if (shouldDisable && acc.status !== "disabled") {
    await vv
      .from("ad_accounts")
      .update({
        status: "disabled",
        last_synced_at: new Date().toISOString(),
        metadata: {
          source: "manual_tiktok_sync",
          tiktok_status: "suspended",
          hecom_cliente_id: CLIENTE,
        },
      })
      .eq("id", acc.id);
    console.log("DISABLED", acc.name, live.status);
    disabled++;
  } else if (shouldActive && acc.status !== "active") {
    await vv
      .from("ad_accounts")
      .update({
        status: "active",
        last_synced_at: new Date().toISOString(),
        metadata: {
          source: "manual_tiktok_sync",
          tiktok_status: "approved",
          hecom_cliente_id: CLIENTE,
        },
      })
      .eq("id", acc.id);
    console.log("ENABLED", acc.name);
    kept++;
  }
}

const approved = [...tiktok.values()].filter((r) => r.kind === "approved");
console.log("\nSummary:", { disabled, enabled: kept, approvedOnTikTok: approved.length });
for (const r of approved) console.log("APPROVED:", r.name, r.bm);
