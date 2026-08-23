#!/usr/bin/env node
/**
 * Aplica fixes conservadores de advertiser_id en Hecom (cliente_tiktok_cuentas).
 *
 * Usa REST HTTPS directo (scripts/lib/hecom-http.mjs).
 * En Windows: npm run audit:hecom:apply-safe  (incluye --use-system-ca)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { updateHecomTiktokCuenta } from "./lib/hecom-http.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = join(root, "tmp", "hecom-audit-stale-ids.csv");
const sqlPath = join(root, "tmp", "hecom-stale-fixes-safe.sql");

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

function normalize(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameTokens(name) {
  return normalize(name)
    .split(" ")
    .filter((t) => t.length >= 3);
}

function isSafeFix(row) {
  if (row.sugerencia_confianza !== "high") return false;
  if (!row.sugerencia_id?.trim()) return false;
  if (row.bm_bucket === "10") return false;
  if (row.advertiser_id === row.sugerencia_id) return false;

  const clientTokens = nameTokens(row.hecom_cliente_name);
  const sug = normalize(row.sugerencia_nombre);
  if (clientTokens.length < 2) return false;

  const matched = clientTokens.filter(
    (t) =>
      sug.includes(t) ||
      (t.length >= 5 &&
        sug.split(" ").some((st) => st.startsWith(t.slice(0, 5)))),
  );
  return matched.length >= 2;
}

function sqlLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply || process.argv.includes("--dry-run");

  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const deduped = rows.filter(isSafeFix);

  const sqlLines = [
    "-- Fixes SAFE generados por apply-hecom-stale-fixes.mjs",
    `-- Fecha: ${new Date().toISOString()}`,
    "BEGIN;",
    "",
  ];

  for (const row of deduped) {
    sqlLines.push(
      `-- ${row.hecom_cliente_name}: ${row.advertiser_id} -> ${row.sugerencia_id} (BM ${row.bm_bucket} -> ${row.sugerencia_bm})`,
    );
    sqlLines.push(`UPDATE cliente_tiktok_cuentas`);
    sqlLines.push(`SET`);
    sqlLines.push(`  advertiser_id = ${sqlLiteral(row.sugerencia_id)},`);
    sqlLines.push(`  advertiser_name = ${sqlLiteral(row.sugerencia_nombre)},`);
    sqlLines.push(
      `  bm_bucket = ${sqlLiteral(row.sugerencia_bm || row.bm_bucket)},`,
    );
    sqlLines.push(`  sync_enabled = true`);
    sqlLines.push(`WHERE client_id = ${sqlLiteral(row.hecom_cliente_id)}`);
    sqlLines.push(`  AND advertiser_id = ${sqlLiteral(row.advertiser_id)};`);
    sqlLines.push("");
  }

  sqlLines.push("COMMIT;");
  mkdirSync(join(root, "tmp"), { recursive: true });
  writeFileSync(sqlPath, sqlLines.join("\n"), "utf8");

  console.log("=== Hecom stale fixes (SAFE) ===");
  console.log("CSV:", csvPath);
  console.log("SQL:", sqlPath);
  console.log("Candidatos SAFE:", deduped.length);
  console.log("");

  if (deduped.length === 0) {
    console.log("Nada que aplicar. Corré npm run audit:hecom primero.");
    return;
  }

  for (const row of deduped) {
    console.log(
      `- ${row.hecom_cliente_name} | ${row.advertiser_id} -> ${row.sugerencia_id} | BM ${row.bm_bucket}->${row.sugerencia_bm}`,
    );
  }

  if (dryRun) {
    console.log("");
    console.log("Dry-run. Para aplicar en Hecom:");
    console.log("  npm run audit:hecom:apply-safe");
    console.log("");
    console.log("O pegá el SQL en Supabase Hecom SQL Editor:");
    console.log(" ", sqlPath);
    return;
  }

  let ok = 0;
  let fail = 0;

  for (const row of deduped) {
    try {
      const updated = await updateHecomTiktokCuenta({
        clientId: row.hecom_cliente_id,
        oldAdvertiserId: row.advertiser_id,
        patch: {
          advertiser_id: row.sugerencia_id.trim(),
          advertiser_name: row.sugerencia_nombre.trim(),
          bm_bucket: row.sugerencia_bm?.trim() || row.bm_bucket?.trim() || null,
          sync_enabled: true,
        },
      });
      ok += 1;
      console.log("OK", row.hecom_cliente_name, updated?.advertiser_id);
    } catch (error) {
      fail += 1;
      console.error(
        "FAIL",
        row.hecom_cliente_name,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log("");
  console.log(`Aplicados: ${ok} | Fallidos: ${fail}`);
  if (fail > 0) {
    console.log("");
    console.log("Si falló por TLS, usá el SQL manual en Supabase Hecom:");
    console.log(" ", sqlPath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
