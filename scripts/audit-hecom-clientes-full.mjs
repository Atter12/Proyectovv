#!/usr/bin/env node
/**
 * Auditoría completa Hecom CRM ↔ TikTok BM.
 *
 * Uso:
 *   node --env-file=.env.local scripts/audit-hecom-clientes-full.mjs
 *
 * Salida en tmp/:
 *   - hecom-audit-resumen.txt
 *   - hecom-audit-cuentas.csv        (todas las filas cliente_tiktok_cuentas)
 *   - hecom-audit-sin-mapeo.csv      (clientes sin ningún ID)
 *   - hecom-audit-stale-ids.csv      (IDs en Hecom que no están en BM + sugerencia)
 *   - hecom-audit-sync-off.csv       (sync_enabled = false)
 *
 * Requiere HECOM_SUPABASE_* . TIKTOK_ACCESS_TOKEN opcional (sin token: solo Hecom).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHecomCrm } from "./lib/hecom-http.mjs";

const BC_IDS = [
  "7575005779271614480",
  "7564426417577148433",
  "7561222896295837712",
];

const BM_FROM_BC = {
  "7575005779271614480": "200",
  "7564426417577148433": "30",
  "7561222896295837712": "10",
};

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
    return { ok: true, confidence: tokens.length >= 2 ? "high" : "medium" };
  }
  const first = tokens[0];
  if (first?.length >= 5) {
    if (adv.startsWith(first) || advTokens.some((t) => tokenFuzzy(first, t))) {
      return { ok: true, confidence: "low" };
    }
  }
  return { ok: false, confidence: "none" };
}

function classify(st) {
  const s = String(st ?? "").toUpperCase();
  if (/SUSPEND|DISABLE|REJECT|PUNISH|BAN|CLOSE|\bLIMIT\b|CONFIRM_FAIL|CONFIRM_MODIFY_FAIL/.test(s)) {
    return "suspended";
  }
  if (/ENABLE|ACTIVE|APPROVE|STATUS_OK|OK/.test(s)) return "approved";
  return "unknown";
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const BM10_BC_ID = "7561222896295837712";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(label, fn, attempts = 3) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (i < attempts && /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(message)) {
        console.warn(`[audit] ${label} intento ${i}/${attempts} falló (${message}), reintentando…`);
        await sleep(800 * i);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function tiktokFetchJson(url, token) {
  let res;
  try {
    res = await fetch(url, { headers: { "Access-Token": token } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : "";
    throw new Error(
      `TikTok fetch failed (${url.hostname}): ${message}${cause ? ` — ${cause}` : ""}`,
    );
  }
  return res.json();
}

function writeCsv(path, header, rows) {
  const lines = [
    header.join(","),
    ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(",")),
  ];
  writeFileSync(path, lines.join("\n"), "utf8");
}

async function fetchAllAdvertisers(token, base) {
  const byId = new Map();
  const errors = [];

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
        const json = await tiktokFetchJson(url, token);
        if (json.code !== 0) {
          errors.push({ bcId, path, code: json.code, message: json.message });
          break;
        }
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
            statusRaw: statusRaw != null ? String(statusRaw) : null,
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

  return { byId, errors };
}

function findNameMatches(clientName, tiktokById, excludeIds = new Set()) {
  return [...tiktokById.values()]
    .map((t) => ({ t, score: scoreMatch(t.advertiserName, clientName) }))
    .filter(
      ({ t, score }) =>
        score.ok &&
        !excludeIds.has(t.advertiserId) &&
        (t.statusKind === "approved" ||
          t.statusKind === "suspended" ||
          t.statusKind === "unknown"),
    )
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2, none: 9 };
      const d = (rank[a.score.confidence] ?? 9) - (rank[b.score.confidence] ?? 9);
      if (d !== 0) return d;
      return a.t.advertiserName.localeCompare(b.t.advertiserName, "es");
    });
}

async function main() {
  const hecomUrl = process.env.HECOM_SUPABASE_URL?.trim();
  const hecomKey = process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY?.trim();
  const token = process.env.TIKTOK_ACCESS_TOKEN?.trim() ?? "";
  const base =
    process.env.TIKTOK_API_BASE_URL ??
    "https://business-api.tiktok.com/open_api/v1.3";

  if (!hecomUrl || !hecomKey) {
    console.error("Faltan HECOM_SUPABASE_URL o HECOM_SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const { clientes, cuentas } = await withRetry("Hecom CRM", () => loadHecomCrm());

  const nameByClientId = new Map(
    (clientes ?? []).map((c) => [String(c.id), String(c.name ?? "")]),
  );
  const cuentasByClient = new Map();
  for (const row of cuentas ?? []) {
    const cid = String(row.client_id);
    if (!cuentasByClient.has(cid)) cuentasByClient.set(cid, []);
    cuentasByClient.get(cid).push(row);
  }

  let tiktokById = new Map();
  let tiktokErrors = [];
  let tiktokAvailable = false;

  if (token) {
    try {
      const fetched = await withRetry("TikTok BM", () =>
        fetchAllAdvertisers(token, base),
      );
      tiktokById = fetched.byId;
      tiktokErrors = fetched.errors;
      tiktokAvailable = tiktokById.size > 0;
      if (!tiktokAvailable && tiktokErrors.length) {
        console.warn(
          "[audit] TikTok respondió pero sin advertisers. Revisá permisos del token (Finance en los 3 BM).",
        );
      }
    } catch (error) {
      console.warn(
        "[audit] TikTok omitido:",
        error instanceof Error ? error.message : error,
      );
      console.warn("[audit] Continuando solo con datos Hecom…");
    }
  }

  const bm10Denied = tiktokErrors.some(
    (err) =>
      err.bcId === BM10_BC_ID &&
      (err.code === 40001 || err.code === 40002),
  );

  const cuentaRows = [];
  const staleRows = [];
  const syncOffRows = [];

  for (const row of cuentas ?? []) {
    const clientId = String(row.client_id);
    const clientName = nameByClientId.get(clientId) ?? "";
    const advertiserId = String(row.advertiser_id ?? "").trim();
    const syncOn = row.sync_enabled !== false;
    const bmBucket = row.bm_bucket ? String(row.bm_bucket) : "";
    const live = tiktokAvailable ? tiktokById.get(advertiserId) : undefined;

    let estado = "hecom_only";
    if (!tiktokAvailable) {
      estado = syncOn ? "ok_hecom_sin_tiktok" : "sync_off";
    } else if (!advertiserId) {
      estado = "sin_advertiser_id";
    } else if (!live) {
      if (bmBucket === "10" && bm10Denied && syncOn) {
        estado = "ok_bm10_sin_verificar";
      } else {
        estado = "stale_id";
      }
    } else if (!syncOn) {
      estado = "sync_off";
    } else if (live.statusKind === "suspended") {
      estado = "suspended_tiktok";
    } else if (live.statusKind === "approved" || live.statusKind === "unknown") {
      estado = "ok";
    } else {
      estado = "revisar";
    }

    const mappedIds = new Set(
      (cuentasByClient.get(clientId) ?? [])
        .map((r) => String(r.advertiser_id ?? "").trim())
        .filter(Boolean),
    );

    const suggestions = tiktokAvailable
      ? findNameMatches(clientName, tiktokById, mappedIds).slice(0, 3)
      : [];

    const topSuggestion = suggestions[0];

    const record = {
      hecom_cliente_id: clientId,
      hecom_cliente_name: clientName,
      cuenta_row_id: row.id ?? "",
      advertiser_id: advertiserId,
      advertiser_name_hecom: row.advertiser_name ?? "",
      bm_bucket: bmBucket,
      sync_enabled: syncOn ? "true" : "false",
      fee: row.fee ?? "",
      estado,
      tiktok_live_name: live?.advertiserName ?? "",
      tiktok_status: live?.statusKind ?? "",
      tiktok_bm: live ? (BM_FROM_BC[live.bcId] ?? live.bcId) : "",
      sugerencia_id: topSuggestion?.t.advertiserId ?? "",
      sugerencia_nombre: topSuggestion?.t.advertiserName ?? "",
      sugerencia_bm: topSuggestion
        ? (BM_FROM_BC[topSuggestion.t.bcId] ?? topSuggestion.t.bcId)
        : "",
      sugerencia_confianza: topSuggestion?.score.confidence ?? "",
      accion:
        estado === "stale_id" && topSuggestion
          ? "UPDATE_advertiser_id_en_hecom"
          : estado === "sync_off"
            ? "IGNORAR_o_reactivar_sync"
            : estado === "ok" ||
                estado === "ok_hecom_sin_tiktok" ||
                estado === "ok_bm10_sin_verificar"
              ? "NINGUNA"
              : estado === "suspended_tiktok"
                ? "REVISAR_suspendida"
                : !bmBucket
                  ? "AGREGAR_bm_bucket"
                  : "REVISAR",
    };

    cuentaRows.push(record);
    if (estado === "stale_id") staleRows.push(record);
    if (estado === "sync_off" || !syncOn) syncOffRows.push(record);
  }

  const sinMapeoRows = [];
  for (const c of clientes ?? []) {
    const cid = String(c.id);
    const rows = cuentasByClient.get(cid) ?? [];
    const legacy = c.tiktok_advertiser_id
      ? String(c.tiktok_advertiser_id).trim()
      : "";
    if (rows.length > 0 || legacy) continue;

    const suggestions = tiktokAvailable
      ? findNameMatches(String(c.name ?? ""), tiktokById).slice(0, 5)
      : [];

    if (suggestions.length === 0) {
      sinMapeoRows.push({
        hecom_cliente_id: cid,
        hecom_cliente_name: c.name ?? "",
        suggested_advertiser_id: "",
        suggested_advertiser_name: "",
        bm_bucket: "",
        tiktok_status: "",
        confidence: "",
        action: tiktokAvailable ? "MANUAL_sin_match_bm" : "MAPEAR_manual",
      });
      continue;
    }

    for (const { t, score } of suggestions) {
      sinMapeoRows.push({
        hecom_cliente_id: cid,
        hecom_cliente_name: c.name ?? "",
        suggested_advertiser_id: t.advertiserId,
        suggested_advertiser_name: t.advertiserName,
        bm_bucket: BM_FROM_BC[t.bcId] ?? "",
        tiktok_status: t.statusKind,
        confidence: score.confidence,
        action:
          score.confidence === "low"
            ? "REVIEW_MANUAL"
            : "INSERT_cliente_tiktok_cuentas",
      });
    }
  }

  const counts = cuentaRows.reduce((acc, row) => {
    acc[row.estado] = (acc[row.estado] ?? 0) + 1;
    return acc;
  }, {});

  const clientesConMapeo = new Set(
    (cuentas ?? []).map((r) => String(r.client_id)),
  ).size;
  const clientesSinMapeo = (clientes ?? []).length - clientesConMapeo;

  const resumen = [
    "=== AUDITORÍA Hecom ↔ TikTok (Holistic) ===",
    `Fecha: ${new Date().toISOString()}`,
    `TikTok API: ${tiktokAvailable ? `OK (${tiktokById.size} advertisers)` : token ? "SIN DATOS (revisar token)" : "OMITIDA (sin TIKTOK_ACCESS_TOKEN)"}`,
    "",
    `Clientes total: ${clientes?.length ?? 0}`,
    `Clientes con mapeo: ${clientesConMapeo}`,
    `Clientes sin mapeo: ${clientesSinMapeo}`,
    `Filas cliente_tiktok_cuentas: ${cuentas?.length ?? 0}`,
    "",
    "--- Por estado de cuenta ---",
    ...Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`),
    "",
    `IDs obsoletos (stale): ${staleRows.length}`,
    `Sync OFF: ${syncOffRows.length}`,
    `Sin mapeo (clientes): ${sinMapeoRows.filter((r, i, arr) => arr.findIndex((x) => x.hecom_cliente_id === r.hecom_cliente_id) === i).length}`,
    "",
  ];

  if (tiktokErrors.length) {
    resumen.push("--- Errores TikTok API ---");
    for (const err of tiktokErrors.slice(0, 5)) {
      resumen.push(`${err.bcId} ${err.path}: [${err.code}] ${err.message}`);
    }
    resumen.push("");
  }

  if (staleRows.length) {
    resumen.push("--- Top stale IDs ---");
    for (const row of staleRows.slice(0, 15)) {
      resumen.push(
        `- ${row.hecom_cliente_name} | ${row.advertiser_id} | sugerencia: ${row.sugerencia_id || "—"} ${row.sugerencia_nombre}`,
      );
    }
    resumen.push("");
  }

  const sinMapeoUnicos = [
    ...new Set(sinMapeoRows.map((r) => r.hecom_cliente_name)),
  ];
  if (sinMapeoUnicos.length) {
    resumen.push("--- Clientes sin mapeo ---");
    for (const name of sinMapeoUnicos) {
      resumen.push(`- ${name}`);
    }
  }

  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = join(root, "tmp");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "hecom-audit-resumen.txt"), resumen.join("\n"), "utf8");

  writeCsv(
    join(outDir, "hecom-audit-cuentas.csv"),
    [
      "hecom_cliente_id",
      "hecom_cliente_name",
      "cuenta_row_id",
      "advertiser_id",
      "advertiser_name_hecom",
      "bm_bucket",
      "sync_enabled",
      "fee",
      "estado",
      "tiktok_live_name",
      "tiktok_status",
      "tiktok_bm",
      "sugerencia_id",
      "sugerencia_nombre",
      "sugerencia_bm",
      "sugerencia_confianza",
      "accion",
    ],
    cuentaRows.sort((a, b) =>
      a.hecom_cliente_name.localeCompare(b.hecom_cliente_name, "es"),
    ),
  );

  writeCsv(
    join(outDir, "hecom-audit-stale-ids.csv"),
    [
      "hecom_cliente_id",
      "hecom_cliente_name",
      "advertiser_id",
      "advertiser_name_hecom",
      "bm_bucket",
      "sugerencia_id",
      "sugerencia_nombre",
      "sugerencia_bm",
      "sugerencia_confianza",
      "accion",
    ],
    staleRows,
  );

  writeCsv(
    join(outDir, "hecom-audit-stale-manual-review.csv"),
    [
      "hecom_cliente_name",
      "advertiser_id_viejo",
      "nombre_hecom",
      "bm_bucket",
      "sugerencia_id",
      "sugerencia_nombre",
      "sugerencia_bm",
      "confianza",
      "nota_revision",
      "sql_where_client_id",
    ],
    staleRows.map((row) => ({
      hecom_cliente_name: row.hecom_cliente_name,
      advertiser_id_viejo: row.advertiser_id,
      nombre_hecom: row.advertiser_name_hecom,
      bm_bucket: row.bm_bucket,
      sugerencia_id: row.sugerencia_id,
      sugerencia_nombre: row.sugerencia_nombre,
      sugerencia_bm: row.sugerencia_bm,
      confianza: row.sugerencia_confianza,
      nota_revision: !row.sugerencia_id
        ? "Sin match en BM 200/30 — revisar en TikTok Ads Manager"
        : row.bm_bucket === "10"
          ? "BM10: ID no visible con token actual. Verificar en TikTok si sigue activo o buscar ID nuevo en BM 10"
          : row.sugerencia_confianza === "low"
            ? "Nombre sugerido no calza bien — NO aplicar automático"
            : row.sugerencia_bm !== row.bm_bucket
              ? "Cambia de BM — confirmar con cliente antes de actualizar Hecom"
              : "Revisar y actualizar advertiser_id en Hecom si coincide",
      sql_where_client_id: row.hecom_cliente_id,
    })),
  );

  writeCsv(
    join(outDir, "hecom-audit-sync-off.csv"),
    [
      "hecom_cliente_id",
      "hecom_cliente_name",
      "advertiser_id",
      "advertiser_name_hecom",
      "bm_bucket",
      "accion",
    ],
    syncOffRows.map((r) => ({
      hecom_cliente_id: r.hecom_cliente_id,
      hecom_cliente_name: r.hecom_cliente_name,
      advertiser_id: r.advertiser_id,
      advertiser_name_hecom: r.advertiser_name_hecom,
      bm_bucket: r.bm_bucket,
      accion: r.accion,
    })),
  );

  writeCsv(
    join(outDir, "hecom-audit-sin-mapeo.csv"),
    [
      "hecom_cliente_id",
      "hecom_cliente_name",
      "suggested_advertiser_id",
      "suggested_advertiser_name",
      "bm_bucket",
      "tiktok_status",
      "confidence",
      "action",
    ],
    sinMapeoRows,
  );

  console.log(resumen.join("\n"));
  console.log("");
  console.log("Archivos en tmp/:");
  console.log("  hecom-audit-resumen.txt");
  console.log("  hecom-audit-cuentas.csv");
  console.log("  hecom-audit-stale-ids.csv");
  console.log("  hecom-audit-stale-manual-review.csv");
  console.log("  hecom-audit-sync-off.csv");
  console.log("  hecom-audit-sin-mapeo.csv");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
