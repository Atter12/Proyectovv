#!/usr/bin/env node
/**
 * Exporta CSV de clientes Hecom sin advertiser_id pero con match por nombre en TikTok BM.
 * Uso: node --env-file=.env.local scripts/export-hecom-name-only-map.mjs
 * Salida: tmp/hecom-tiktok-name-only-map.csv (gitignored vía tmp/)
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BC_IDS = [
  "7575005779271614480",
  "7564426417577148433",
  "7561222896295837712",
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

function scoreMatch(advName, clientName) {
  const adv = normalize(advName);
  const client = normalize(clientName);
  if (!adv || !client || client.length < 4) return { ok: false, confidence: "none" };

  if (adv === client || adv.startsWith(`${client} `) || adv.startsWith(client)) {
    return { ok: true, confidence: "high" };
  }

  const tokens = client.split(" ").filter((t) => t.length >= 3);
  const advTokens = adv.split(" ").filter(Boolean);
  if (!tokens.length) return { ok: false, confidence: "none" };

  const allTokens =
    tokens.length &&
    tokens.every(
      (t) => adv.includes(t) || advTokens.some((at) => tokenFuzzy(t, at)),
    );
  if (allTokens) {
    return {
      ok: true,
      confidence: tokens.length >= 2 ? "high" : "medium",
    };
  }

  // Soft: solo primer nombre largo — revisar a mano (Adrian≠Adriana, Cesar≠Cesar Bazan ajeno)
  const first = tokens[0];
  if (first?.length >= 5) {
    if (adv.startsWith(first) || advTokens.some((t) => tokenFuzzy(first, t))) {
      return { ok: true, confidence: "low" };
    }
  }
  return { ok: false, confidence: "none" };
}

function matches(advName, clientName) {
  return scoreMatch(advName, clientName).ok;
}

function classify(st) {
  const s = String(st ?? "").toUpperCase();
  if (/SUSPEND|DISABLE|REJECT|PUNISH|BAN|CLOSE|\bLIMIT\b|CONFIRM_FAIL|CONFIRM_MODIFY_FAIL/.test(s)) return "suspended";
  if (/ENABLE|ACTIVE|APPROVE|STATUS_OK|OK/.test(s)) return "approved";
  return "unknown";
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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

function bmBucketFromBc(bcId) {
  if (bcId === "7575005779271614480") return "200";
  if (bcId === "7564426417577148433") return "30";
  if (bcId === "7561222896295837712") return "10";
  return "";
}

async function main() {
  const hecomUrl = process.env.HECOM_SUPABASE_URL;
  const hecomKey = process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  const base =
    process.env.TIKTOK_API_BASE_URL ??
    "https://business-api.tiktok.com/open_api/v1.3";

  if (!hecomUrl || !hecomKey || !token) {
    console.error("Faltan HECOM_* o TIKTOK_ACCESS_TOKEN en env.");
    process.exit(1);
  }

  const hecom = createClient(hecomUrl, hecomKey);
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

  const rows = [];
  for (const c of clientes ?? []) {
    const ids = new Set();
    if (c.tiktok_advertiser_id) ids.add(String(c.tiktok_advertiser_id));
    for (const m of multiByClient.get(c.id) ?? []) {
      if (m.advertiser_id) ids.add(String(m.advertiser_id));
    }

    const liveHits = [...ids].map((id) => tiktok.get(id)).filter(Boolean);
    if (liveHits.length) continue;

    const nameHits = [...tiktok.values()]
      .map((t) => ({ t, score: scoreMatch(t.advertiserName, c.name) }))
      .filter(
        ({ t, score }) =>
          score.ok &&
          (t.statusKind === "approved" || t.statusKind === "suspended") &&
          !ids.has(t.advertiserId),
      );
    if (!nameHits.length) continue;

    for (const { t: hit, score } of nameHits) {
      rows.push({
        hecom_cliente_id: c.id,
        hecom_cliente_name: c.name,
        suggested_advertiser_id: hit.advertiserId,
        suggested_advertiser_name: hit.advertiserName,
        tiktok_status: hit.statusKind,
        bc_id: hit.bcId,
        bm_bucket: bmBucketFromBc(hit.bcId),
        confidence: score.confidence,
        action:
          score.confidence === "low"
            ? "REVIEW_MANUAL"
            : "INSERT_cliente_tiktok_cuentas",
      });
    }
  }

  rows.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    const d = (rank[a.confidence] ?? 9) - (rank[b.confidence] ?? 9);
    if (d !== 0) return d;
    return a.hecom_cliente_name.localeCompare(b.hecom_cliente_name, "es");
  });

  const header = [
    "hecom_cliente_id",
    "hecom_cliente_name",
    "suggested_advertiser_id",
    "suggested_advertiser_name",
    "tiktok_status",
    "bc_id",
    "bm_bucket",
    "confidence",
    "action",
  ];

  const lines = [
    header.join(","),
    ...rows.map((r) => header.map((k) => csvEscape(r[k])).join(",")),
  ];

  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = join(root, "tmp");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "hecom-tiktok-name-only-map.csv");
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");

  // Solo high/medium para import seguro
  const safe = rows.filter((r) => r.confidence !== "low");
  const safePath = join(outDir, "hecom-tiktok-name-only-map-SAFE.csv");
  writeFileSync(
    safePath,
    [
      header.join(","),
      ...safe.map((r) => header.map((k) => csvEscape(r[k])).join(",")),
    ].join("\n") + "\n",
    "utf8",
  );

  const uniqueClients = new Set(rows.map((r) => r.hecom_cliente_id));
  const uniqueSafe = new Set(safe.map((r) => r.hecom_cliente_id));
  const byConf = { high: 0, medium: 0, low: 0 };
  for (const r of rows) byConf[r.confidence] = (byConf[r.confidence] ?? 0) + 1;

  console.log("OK");
  console.log("clientes_solo_nombre=", uniqueClients.size);
  console.log("filas_sugeridas=", rows.length);
  console.log("filas_high=", byConf.high, "medium=", byConf.medium, "low=", byConf.low);
  console.log("clientes_SAFE=", uniqueSafe.size, "filas_SAFE=", safe.length);
  console.log("archivo=", outPath);
  console.log("archivo_SAFE=", safePath);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
