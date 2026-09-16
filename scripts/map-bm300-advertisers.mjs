#!/usr/bin/env node
/**
 * BM 300 → Hecom `cliente_tiktok_cuentas`.
 *
 * Sin fila Hecom el cliente no ve la cuenta en Cuentas ads ni en Asignar
 * (ad-accounts.server.ts solo enriquece por advertiser_id mapeado).
 *
 * Uso:
 *   node --env-file=.env.local scripts/map-bm300-advertisers.mjs            # audit
 *   node --env-file=.env.local scripts/map-bm300-advertisers.mjs --apply    # inserta high
 */
import { createClient } from "@supabase/supabase-js";

const BC_ID = "7680955666005196801";
const BM_BUCKET = "300";
const API =
  process.env.TIKTOK_API_BASE_URL ??
  "https://business-api.tiktok.com/open_api/v1.3";

const apply = process.argv.includes("--apply");

/** Sufijos de naming BM ("Juan Perez 300.0 USD - Agencia" → "juan perez"). */
const NAME_NOISE =
  /\b(usd|agencia|agency|holistic|proalba|bm|cuenta|ads|tiktok|ent|enterprise|entreprise|s\s?a\s?c|eirl|srl)\b/g;

/** Cuentas internas / smoke test: nunca se mapean a un cliente. */
const NOT_A_CLIENT = /\b(prueba|test|demo|libre|proalba|holistic)\b/;

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function advertiserCore(advertiserName) {
  return normalize(advertiserName)
    .replace(/\b\d+(\s\d+)?\b/g, " ")
    .replace(NAME_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return value.split(" ").filter((token) => token.length >= 3);
}

/** Distancia de edición ≤1: Hecom escribe "Jonatan", TikTok "Jhonatan". */
function nearEqual(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (short.length === long.length) {
      i += 1;
      j += 1;
    } else {
      j += 1;
    }
  }
  return edits + (long.length - j) + (short.length - i) <= 1;
}

function tokenIn(token, list) {
  return list.some((candidate) => nearEqual(token, candidate));
}

/**
 * high   = el nombre del advertiser queda cubierto por el nombre del cliente
 *          (>=2 tokens), o todos los tokens del cliente aparecen en el advertiser
 * medium = coincidencia parcial de 2 tokens
 */
function scoreMatch(advertiserName, clienteName) {
  const adv = advertiserCore(advertiserName);
  const cliente = normalize(clienteName);
  if (!adv || cliente.length < 4) return null;

  const clienteTokens = tokens(cliente);
  const advTokens = tokens(adv);
  if (!clienteTokens.length || !advTokens.length) return null;

  const hits = clienteTokens.filter((token) => tokenIn(token, advTokens));
  if (!hits.length) return null;

  const advCovered = advTokens.every((token) => tokenIn(token, clienteTokens));

  if (advCovered && advTokens.length >= 2) {
    return { confidence: "high", hits: hits.length, of: clienteTokens.length };
  }
  if (hits.length === clienteTokens.length && clienteTokens.length >= 2) {
    return { confidence: "high", hits: hits.length, of: clienteTokens.length };
  }
  if (hits.length >= 2) {
    return { confidence: "medium", hits: hits.length, of: clienteTokens.length };
  }
  if (clienteTokens.length === 1 && nearEqual(adv, cliente)) {
    return { confidence: "high", hits: 1, of: 1 };
  }
  return { confidence: "low", hits: hits.length, of: clienteTokens.length };
}

function classifyStatus(status) {
  const value = String(status ?? "").toUpperCase();
  if (!value) return "unknown";
  if (/SUSPEND|DISABLE|REJECT|PUNISH|BAN|CLOSE|LIMIT|CONFIRM_FAIL/.test(value)) {
    return "suspended";
  }
  if (/ENABLE|ACTIVE|APPROVE|STATUS_OK|STATUS_BOUND|^OK$/.test(value)) {
    return "approved";
  }
  return "unknown";
}

async function fetchBm300Advertisers(token) {
  const byId = new Map();
  for (const path of ["/bc/asset/admin/get/", "/bc/asset/get/"]) {
    let page = 1;
    let totalPages = 1;
    let got = 0;
    while (page <= totalPages && page <= 40) {
      const url = new URL(`${API}${path}`);
      url.searchParams.set("bc_id", BC_ID);
      url.searchParams.set("asset_type", "ADVERTISER");
      url.searchParams.set("page", String(page));
      url.searchParams.set("page_size", "50");
      const res = await fetch(url, { headers: { "Access-Token": token } });
      const json = await res.json();
      if (json.code !== 0) {
        console.warn(`[tiktok] ${path} code=${json.code} msg=${json.message}`);
        break;
      }
      const list = json.data?.list ?? json.data?.assets ?? [];
      for (const row of list) {
        const info = row.advertiser_info ?? row.asset_info ?? row;
        const id = String(info.advertiser_id ?? info.asset_id ?? "").trim();
        if (!/^\d{10,19}$/.test(id)) continue;
        byId.set(id, {
          advertiserId: id,
          advertiserName: String(
            info.advertiser_name ?? info.asset_name ?? info.name ?? "",
          ).trim(),
          statusKind: classifyStatus(
            info.advertiser_show_status ?? info.advertiser_status ?? info.status,
          ),
        });
      }
      got += list.length;
      totalPages = Number(json.data?.page_info?.total_page ?? 1) || 1;
      if (!list.length) break;
      page += 1;
    }
    if (got > 0) break;
  }
  return [...byId.values()];
}

async function main() {
  const token = process.env.TIKTOK_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("Falta TIKTOK_ACCESS_TOKEN");

  const hecom = createClient(
    process.env.HECOM_SUPABASE_URL,
    process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY,
  );

  const [advertisers, clientesRes, mappedRes] = await Promise.all([
    fetchBm300Advertisers(token),
    hecom.from("clientes").select("id,name,tiktok_advertiser_id").limit(2000),
    hecom
      .from("cliente_tiktok_cuentas")
      .select("client_id,advertiser_id,advertiser_name,bm_bucket")
      .limit(5000),
  ]);

  if (clientesRes.error) throw new Error(clientesRes.error.message);
  if (mappedRes.error) throw new Error(mappedRes.error.message);

  const clientes = clientesRes.data ?? [];
  const mapped = mappedRes.data ?? [];
  const mappedByAdvertiser = new Map(
    mapped.map((row) => [String(row.advertiser_id), row]),
  );
  const clienteById = new Map(clientes.map((row) => [String(row.id), row]));

  const already = [];
  const candidates = [];
  const ambiguous = [];
  const orphans = [];
  const internal = [];

  for (const advertiser of advertisers) {
    if (NOT_A_CLIENT.test(normalize(advertiser.advertiserName))) {
      internal.push(advertiser);
      continue;
    }

    const existing = mappedByAdvertiser.get(advertiser.advertiserId);
    if (existing) {
      already.push({
        advertiser,
        clienteName:
          clienteById.get(String(existing.client_id))?.name ?? "(desconocido)",
        bmBucket: existing.bm_bucket,
      });
      continue;
    }

    const scored = [];
    for (const cliente of clientes) {
      const score = scoreMatch(advertiser.advertiserName, cliente.name);
      if (score && score.confidence !== "low") {
        scored.push({ cliente, ...score });
      }
    }

    const high = scored.filter((row) => row.confidence === "high");
    const pool = high.length ? high : scored;

    if (pool.length === 1) {
      candidates.push({ advertiser, ...pool[0] });
    } else if (pool.length > 1) {
      ambiguous.push({ advertiser, options: pool });
    } else {
      orphans.push(advertiser);
    }
  }

  console.log("=== BM 300 → Hecom ===");
  console.log("advertisers_bm300 =", advertisers.length);
  console.log("  approved =", advertisers.filter((a) => a.statusKind === "approved").length);
  console.log("  suspended =", advertisers.filter((a) => a.statusKind === "suspended").length);
  console.log("  unknown  =", advertisers.filter((a) => a.statusKind === "unknown").length);
  console.log("hecom_clientes =", clientes.length);
  console.log("ya_mapeadas =", already.length);
  console.log("match_unico =", candidates.length);
  console.log("ambiguas =", ambiguous.length);
  console.log("sin_cliente =", orphans.length);
  console.log("internas_ignoradas =", internal.length);

  if (already.length) {
    console.log("\n--- ya mapeadas ---");
    for (const row of already) {
      console.log(
        ` ${row.advertiser.advertiserName} → ${row.clienteName} (bucket ${row.bmBucket})`,
      );
    }
  }

  console.log("\n--- match unico (insertables) ---");
  for (const row of candidates) {
    console.log(
      ` [${row.confidence}] ${row.advertiser.advertiserName} (${row.advertiser.statusKind}) → ${row.cliente.name} · ${row.cliente.id}`,
    );
  }

  if (ambiguous.length) {
    console.log("\n--- ambiguas (revisar a mano) ---");
    for (const row of ambiguous) {
      console.log(
        ` ${row.advertiser.advertiserName} → ${row.options
          .map((o) => `${o.cliente.name} [${o.confidence}]`)
          .join(" | ")}`,
      );
    }
  }

  if (orphans.length) {
    console.log("\n--- sin cliente Hecom ---");
    for (const row of orphans) {
      console.log(` ${row.advertiserName} (${row.advertiserId}) ${row.statusKind}`);
    }
  }

  if (internal.length) {
    console.log("\n--- internas / smoke (ignoradas) ---");
    for (const row of internal) {
      console.log(` ${row.advertiserName} (${row.advertiserId})`);
    }
  }

  const insertable = candidates.filter((row) => row.confidence === "high");

  if (!apply) {
    console.log(
      `\nDRY_RUN — ${insertable.length} filas high listas. Rerun con --apply.`,
    );
    return;
  }

  let inserted = 0;
  for (const row of insertable) {
    const { error } = await hecom.from("cliente_tiktok_cuentas").insert({
      client_id: row.cliente.id,
      advertiser_id: row.advertiser.advertiserId,
      advertiser_name: row.advertiser.advertiserName,
      bm_bucket: BM_BUCKET,
      // `fee` es % de comisión (5–10), NO el tier del BM: null → cae al fee del cliente.
      fee: null,
      sync_enabled: true,
    });
    if (error) {
      console.error(
        `INSERT_FAIL ${row.advertiser.advertiserName}: ${error.message}`,
      );
      continue;
    }
    inserted += 1;

    if (!row.cliente.tiktok_advertiser_id) {
      await hecom
        .from("clientes")
        .update({
          tiktok_advertiser_id: row.advertiser.advertiserId,
          tiktok_advertiser_name: row.advertiser.advertiserName,
          tiktok_sync_enabled: true,
        })
        .eq("id", row.cliente.id);
    }
  }

  console.log("\nINSERTED =", inserted);
  console.log("APPLY_OK");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
