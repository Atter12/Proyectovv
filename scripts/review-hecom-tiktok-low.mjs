#!/usr/bin/env node
/**
 * Revisa filas confidence=low y genera:
 * - tmp/hecom-tiktok-low-REVIEW.csv (todas low)
 * - tmp/hecom-tiktok-low-APPROVED.csv (heurística conservadora: apellido+nombre o casi exacto)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "tmp", "hecom-tiktok-name-only-map.csv");

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

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normalize(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        prevDiag + cost,
      );
      prevDiag = temp;
    }
  }
  return prev[b.length];
}

function tokenFuzzy(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  const maxDist = Math.max(a.length, b.length) >= 8 ? 2 : 1;
  return editDistance(a, b) <= maxDist;
}

/**
 * Re-score low rows more strictly for second-pass approval.
 */
function secondPass(clienteName, advName) {
  const client = normalize(clienteName);
  const adv = normalize(advName);
  const tokens = client.split(" ").filter((t) => t.length >= 3);
  const advTokens = adv.split(" ").filter(Boolean);

  if (adv.startsWith(client) || adv.startsWith(`${client} `)) {
    return { verdict: "APPROVE", reason: "full_name_prefix" };
  }

  if (tokens.length >= 2) {
    const first = tokens[0];
    const second = tokens[1];
    const last = tokens[tokens.length - 1];
    const has = (tok) =>
      adv.includes(tok) || advTokens.some((t) => tokenFuzzy(tok, t));

    if (has(first) && has(last) && last !== first) {
      return { verdict: "APPROVE", reason: "first_and_last" };
    }
    if (has(first) && has(second)) {
      return { verdict: "APPROVE", reason: "first_and_second" };
    }
    const allOk = tokens.every((t) => has(t));
    if (allOk) return { verdict: "APPROVE", reason: "all_tokens" };
  }

  // Allowlist explícita: mismo operador, nombre distinto en TikTok
  const allow = [
    {
      client: "christian ocampo",
      advMustInclude: ["christian", "ricaldi"],
      reason: "alias_ocampo_ricaldi",
    },
  ];
  for (const rule of allow) {
    if (client === rule.client || client.startsWith(rule.client)) {
      if (rule.advMustInclude.every((t) => adv.includes(t))) {
        return { verdict: "APPROVE", reason: rule.reason };
      }
    }
  }

  return { verdict: "REJECT", reason: "soft_first_name_only_or_ambiguous" };
}

function writeCsv(path, header, rows) {
  const lines = [
    header.join(","),
    ...rows.map((r) => header.map((h) => csvEscape(r[h])).join(",")),
  ];
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}

const all = parseCsv(readFileSync(src, "utf8"));
const low = all.filter((r) => r.confidence === "low");

const reviewed = low.map((r) => {
  const pass = secondPass(r.hecom_cliente_name, r.suggested_advertiser_name);
  return {
    ...r,
    verdict: pass.verdict,
    reason: pass.reason,
    action:
      pass.verdict === "APPROVE"
        ? "INSERT_cliente_tiktok_cuentas"
        : "SKIP_REVIEW",
  };
});

const approved = reviewed.filter((r) => r.verdict === "APPROVE");
const rejected = reviewed.filter((r) => r.verdict === "REJECT");

mkdirSync(join(root, "tmp"), { recursive: true });

const reviewHeader = [
  "hecom_cliente_id",
  "hecom_cliente_name",
  "suggested_advertiser_id",
  "suggested_advertiser_name",
  "tiktok_status",
  "bc_id",
  "bm_bucket",
  "confidence",
  "verdict",
  "reason",
  "action",
];

writeCsv(join(root, "tmp", "hecom-tiktok-low-REVIEW.csv"), reviewHeader, reviewed);
writeCsv(
  join(root, "tmp", "hecom-tiktok-low-APPROVED.csv"),
  [
    "hecom_cliente_id",
    "hecom_cliente_name",
    "suggested_advertiser_id",
    "suggested_advertiser_name",
    "tiktok_status",
    "bc_id",
    "bm_bucket",
    "confidence",
    "action",
  ],
  approved.map((r) => ({
    hecom_cliente_id: r.hecom_cliente_id,
    hecom_cliente_name: r.hecom_cliente_name,
    suggested_advertiser_id: r.suggested_advertiser_id,
    suggested_advertiser_name: r.suggested_advertiser_name,
    tiktok_status: r.tiktok_status,
    bc_id: r.bc_id,
    bm_bucket: r.bm_bucket,
    confidence: "reviewed_high",
    action: "INSERT_cliente_tiktok_cuentas",
  })),
);

const byClientReject = new Map();
for (const r of rejected) {
  if (!byClientReject.has(r.hecom_cliente_name)) {
    byClientReject.set(r.hecom_cliente_name, []);
  }
  byClientReject.get(r.hecom_cliente_name).push(r.suggested_advertiser_name);
}

console.log("low_rows=", low.length);
console.log("approved=", approved.length);
console.log("rejected=", rejected.length);
console.log("approved_clients=", new Set(approved.map((r) => r.hecom_cliente_id)).size);
console.log("rejected_clients=", byClientReject.size);
console.log("--- APPROVED sample ---");
for (const r of approved.slice(0, 15)) {
  console.log(
    `${r.hecom_cliente_name} => ${r.suggested_advertiser_name} (${r.reason})`,
  );
}
console.log("--- REJECTED clients (ambiguous) ---");
for (const [name, names] of [...byClientReject.entries()].sort((a, b) =>
  a[0].localeCompare(b[0], "es"),
)) {
  console.log(`${name} <= ${[...new Set(names)].slice(0, 4).join(" | ")}`);
}
