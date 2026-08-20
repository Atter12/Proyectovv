#!/usr/bin/env node
/**
 * Inserta filas SAFE en Hecom.cliente_tiktok_cuentas.
 * Uso:
 *   node --env-file=.env.local scripts/import-hecom-tiktok-safe.mjs --dry-run
 *   node --env-file=.env.local scripts/import-hecom-tiktok-safe.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvArg = process.argv.find((a) => a.startsWith("--csv="));
const csvPath = csvArg
  ? join(root, csvArg.slice("--csv=".length).replace(/^\.\//, ""))
  : join(root, "tmp", "hecom-tiktok-name-only-map-SAFE.csv");

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
        continue;
      }
      if (ch === "," && !inQ) {
        cols.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cols.push(cur);
    const row = {};
    header.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function feeFromBucket(bm) {
  const n = Number(bm);
  if (Number.isFinite(n)) return n;
  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply || process.argv.includes("--dry-run");

  const hecom = createClient(
    process.env.HECOM_SUPABASE_URL,
    process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY,
  );

  const rows = parseCsv(readFileSync(csvPath, "utf8")).filter(
    (r) =>
      r.action === "INSERT_cliente_tiktok_cuentas" &&
      (r.confidence === "high" ||
        r.confidence === "medium" ||
        r.confidence === "reviewed_high"),
  );

  console.log("csv=", csvPath);

  const advertiserIds = rows.map((r) => r.suggested_advertiser_id);
  const { data: existing, error: exErr } = await hecom
    .from("cliente_tiktok_cuentas")
    .select("id,client_id,advertiser_id,advertiser_name")
    .in("advertiser_id", advertiserIds);
  if (exErr) throw new Error(exErr.message);

  const byAdv = new Map(
    (existing ?? []).map((e) => [String(e.advertiser_id), e]),
  );

  const toInsert = [];
  const skippedSame = [];
  const skippedOtherClient = [];

  for (const r of rows) {
    const advId = r.suggested_advertiser_id;
    const hit = byAdv.get(advId);
    if (hit) {
      if (String(hit.client_id) === r.hecom_cliente_id) {
        skippedSame.push({
          cliente: r.hecom_cliente_name,
          advertiser_id: advId,
        });
      } else {
        skippedOtherClient.push({
          cliente: r.hecom_cliente_name,
          advertiser_id: advId,
          other_client_id: hit.client_id,
          other_name: hit.advertiser_name,
        });
      }
      continue;
    }
    toInsert.push({
      client_id: r.hecom_cliente_id,
      advertiser_id: advId,
      advertiser_name: r.suggested_advertiser_name,
      bm_bucket: r.bm_bucket || null,
      fee: feeFromBucket(r.bm_bucket),
      sync_enabled: true,
      _cliente_name: r.hecom_cliente_name,
      _confidence: r.confidence,
    });
  }

  console.log("mode=", dryRun ? "DRY_RUN" : "APPLY");
  console.log("csv_rows=", rows.length);
  console.log("to_insert=", toInsert.length);
  console.log("skip_already_same_client=", skippedSame.length);
  console.log("skip_linked_other_client=", skippedOtherClient.length);
  if (skippedOtherClient.length) {
    console.log("conflicts=", JSON.stringify(skippedOtherClient, null, 2));
  }
  console.log(
    "preview=",
    toInsert
      .slice(0, 8)
      .map((x) => `${x._cliente_name} → ${x.advertiser_name}`)
      .join(" | "),
  );

  if (dryRun) {
    console.log("DRY_RUN_OK — rerun with --apply to insert");
    return;
  }

  const payload = toInsert.map(
    ({ client_id, advertiser_id, advertiser_name, bm_bucket, fee, sync_enabled }) => ({
      client_id,
      advertiser_id,
      advertiser_name,
      bm_bucket,
      fee,
      sync_enabled,
    }),
  );

  // Insert in chunks
  let inserted = 0;
  for (let i = 0; i < payload.length; i += 25) {
    const chunk = payload.slice(i, i + 25);
    const { data, error } = await hecom
      .from("cliente_tiktok_cuentas")
      .insert(chunk)
      .select("id,client_id,advertiser_id");
    if (error) {
      console.error("INSERT_FAIL at chunk", i, error.message);
      process.exit(1);
    }
    inserted += data?.length ?? 0;
  }

  // Optionally set clientes.tiktok_advertiser_id if empty (primary)
  let primaries = 0;
  const byClient = new Map();
  for (const row of toInsert) {
    if (!byClient.has(row.client_id)) byClient.set(row.client_id, row);
  }
  for (const [clientId, first] of byClient) {
    const { data: cliente } = await hecom
      .from("clientes")
      .select("id,tiktok_advertiser_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!cliente) continue;
    if (cliente.tiktok_advertiser_id) continue;
    const { error } = await hecom
      .from("clientes")
      .update({
        tiktok_advertiser_id: first.advertiser_id,
        tiktok_advertiser_name: first.advertiser_name,
        tiktok_sync_enabled: true,
      })
      .eq("id", clientId);
    if (!error) primaries += 1;
  }

  const { count } = await hecom
    .from("cliente_tiktok_cuentas")
    .select("*", { count: "exact", head: true });

  console.log("INSERTED=", inserted);
  console.log("PRIMARY_SET_ON_CLIENTES=", primaries);
  console.log("table_total_now=", count);
  console.log("APPLY_OK");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
