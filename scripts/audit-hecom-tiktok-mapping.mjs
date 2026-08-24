#!/usr/bin/env node
/**
 * Audita mapeo Hecom CRM ↔ TikTok BM.
 * Uso: node --env-file=.env.local scripts/audit-hecom-tiktok-mapping.mjs
 */
import { createClient } from "@supabase/supabase-js";

const BC_IDS = [
  "7575005779271614480",
  "7564426417577148433",
  "7652451146933698576",
];

function normalize(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenFuzzy(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  let mismatches = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) mismatches++;
    if (mismatches > 1) return false;
  }
  return mismatches + Math.abs(a.length - b.length) <= 1;
}

function matches(advName, clientName) {
  const adv = normalize(advName);
  const client = normalize(clientName);
  if (!adv || !client || client.length < 4) return false;
  if (adv === client || adv.startsWith(`${client} `) || adv.startsWith(client)) {
    return true;
  }
  const tokens = client.split(" ").filter((t) => t.length >= 3);
  const advTokens = adv.split(" ").filter(Boolean);
  if (
    tokens.length &&
    tokens.every(
      (t) =>
        adv.includes(t) || advTokens.some((at) => tokenFuzzy(t, at)),
    )
  ) {
    return true;
  }
  const first = tokens[0];
  if (first?.length >= 5) {
    if (adv.startsWith(first) || advTokens.some((t) => tokenFuzzy(first, t))) {
      return true;
    }
  }
  return false;
}

function classify(st) {
  const s = String(st ?? "").toUpperCase();
  if (/SUSPEND|DISABLE|REJECT|PUNISH|BAN|CLOSE|\bLIMIT\b|CONFIRM_FAIL|CONFIRM_MODIFY_FAIL/.test(s)) return "suspended";
  if (/ENABLE|ACTIVE|APPROVE|STATUS_OK|OK/.test(s)) return "approved";
  return "unknown";
}

async function fetchAllAdvertisers(token, base) {
  const byId = new Map();
  for (const bcId of BC_IDS) {
    for (const path of ["/bc/asset/admin/get/", "/bc/asset/get/"]) {
      let page = 1;
      let total = 1;
      let got = 0;
      while (page <= total && page <= 40) {
        const url = new URL(`${base}${path}`);
        url.searchParams.set("bc_id", bcId);
        url.searchParams.set("asset_type", "ADVERTISER");
        url.searchParams.set("page", String(page));
        url.searchParams.set("page_size", "50");
        const res = await fetch(url, {
          headers: { "Access-Token": token },
        });
        const json = await res.json();
        if (json.code !== 0) break;
        const list = json.data?.list ?? json.data?.assets ?? [];
        for (const row of list) {
          const info = row.advertiser_info ?? row.asset_info ?? row;
          const id = String(
            info.advertiser_id ?? info.asset_id ?? row.advertiser_id ?? "",
          ).trim();
          if (!/^\d{10,19}$/.test(id)) continue;
          const name = String(
            info.advertiser_name ??
              info.asset_name ??
              info.name ??
              row.advertiser_name ??
              "",
          ).trim();
          const statusRaw =
            info.status ?? info.advertiser_status ?? row.status ?? null;
          byId.set(id, {
            advertiserId: id,
            advertiserName: name,
            statusKind: classify(statusRaw),
            bcId,
          });
        }
        got += list.length;
        total = Number(json.data?.page_info?.total_page ?? 1);
        if (!list.length) break;
        page++;
      }
      if (got > 0) break;
    }
  }
  return byId;
}

async function main() {
  const hecom = createClient(
    process.env.HECOM_SUPABASE_URL,
    process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY,
  );
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  const base =
    process.env.TIKTOK_API_BASE_URL ??
    "https://business-api.tiktok.com/open_api/v1.3";

  const [{ data: clientes, error }, { data: multi }] = await Promise.all([
    hecom
      .from("clientes")
      .select("id,name,tiktok_advertiser_id,tiktok_advertiser_name")
      .limit(500),
    hecom
      .from("cliente_tiktok_cuentas")
      .select("client_id,advertiser_id,advertiser_name")
      .limit(3000),
  ]);
  if (error) throw new Error(error.message);

  const tiktok = await fetchAllAdvertisers(token, base);
  const multiByClient = new Map();
  for (const row of multi ?? []) {
    const cid = String(row.client_id);
    if (!multiByClient.has(cid)) multiByClient.set(cid, []);
    multiByClient.get(cid).push(row);
  }

  const buckets = {
    idOk: [],
    staleId: [],
    nameOnly: [],
    manual: [],
  };

  for (const c of clientes ?? []) {
    const ids = new Set();
    if (c.tiktok_advertiser_id) ids.add(String(c.tiktok_advertiser_id));
    for (const m of multiByClient.get(c.id) ?? []) {
      if (m.advertiser_id) ids.add(String(m.advertiser_id));
    }

    const liveHits = [...ids]
      .map((id) => tiktok.get(id))
      .filter(Boolean);
    const nameHits = [...tiktok.values()].filter(
      (t) =>
        (t.statusKind === "approved" || t.statusKind === "suspended") &&
        !ids.has(t.advertiserId) &&
        matches(t.advertiserName, c.name),
    );

    if (liveHits.length) {
      buckets.idOk.push({
        cliente: c.name,
        cuentas: liveHits.map(
          (x) => `${x.advertiserName} [${x.statusKind}]`,
        ),
      });
    } else if (nameHits.length) {
      buckets.nameOnly.push({
        cliente: c.name,
        sugerencia: nameHits.slice(0, 4).map((x) => ({
          id: x.advertiserId,
          name: x.advertiserName,
          status: x.statusKind,
        })),
      });
    } else if (ids.size) {
      buckets.staleId.push({ cliente: c.name, ids: [...ids] });
    } else {
      buckets.manual.push({ cliente: c.name });
    }
  }

  console.log("=== AUDIT Hecom ↔ TikTok ===");
  console.log("Clientes:", clientes?.length ?? 0);
  console.log("Advertisers BM:", tiktok.size);
  console.log("OK (ID en BM):", buckets.idOk.length);
  console.log("Solo nombre (falta ID Hecom):", buckets.nameOnly.length);
  console.log("ID obsoleto (no en BM):", buckets.staleId.length);
  console.log("Sin match (manual):", buckets.manual.length);
  console.log("\n--- Solo nombre (top 10) ---");
  for (const row of buckets.nameOnly.slice(0, 10)) {
    console.log(row.cliente, "→", row.sugerencia);
  }
  console.log("\n--- Manual (top 10) ---");
  for (const row of buckets.manual.slice(0, 10)) {
    console.log("-", row.cliente);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
