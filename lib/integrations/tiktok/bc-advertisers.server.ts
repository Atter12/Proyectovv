import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";

interface TikTokApiResponse<T> {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
}

export type TikTokBcAdvertiserStatusKind = "approved" | "suspended" | "unknown";

export type TikTokBcAdvertiser = {
  advertiserId: string;
  advertiserName: string;
  statusRaw: string | null;
  statusKind: TikTokBcAdvertiserStatusKind;
  bcId: string;
};

const DEFAULT_HOLISTIC_BC_IDS = [
  "7575005779271614480", // BM Entreprise 200
  "7564426417577148433", // BM Entreprise 30
  "7561222896295837712", // BM Entreprise 10
];

/** bm_bucket Hecom → BC ID real */
export const HECOM_BM_BUCKET_TO_BC: Record<string, string> = {
  "200": "7575005779271614480",
  "30": "7564426417577148433",
  "10": "7561222896295837712",
};

const cache = new Map<
  string,
  { at: number; advertisers: TikTokBcAdvertiser[] }
>();
const CACHE_MS = 5 * 60 * 1000;
let warming = false;

/**
 * Devuelve lista en cache (fresca o stale ≤15 min) sin llamar a TikTok.
 * null = nunca se cacheó.
 */
export function peekHolisticBcAdvertisersCache(options?: {
  allowStaleMs?: number;
}): TikTokBcAdvertiser[] | null {
  const hit = cache.get("holistic-bcs");
  if (!hit) return null;
  const maxAge = options?.allowStaleMs ?? CACHE_MS * 3;
  if (Date.now() - hit.at > maxAge) return null;
  return hit.advertisers;
}

/** Dispara refresh en background sin bloquear la request. */
export function warmHolisticBcAdvertisers(input?: {
  organizationId?: string;
}): void {
  if (warming) return;
  const hit = cache.get("holistic-bcs");
  if (hit && Date.now() - hit.at < CACHE_MS) return;
  warming = true;
  void listHolisticBcAdvertisers(input)
    .catch((error) => {
      console.warn("[tiktok-bc] warm_failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    })
    .finally(() => {
      warming = false;
    });
}

/**
 * Cache-first: no espera TikTok en cold start.
 * Usar en páginas de listado (Cuentas ads) para navegación rápida.
 */
export async function listHolisticBcAdvertisersCachedFirst(input?: {
  organizationId?: string;
  forceRefresh?: boolean;
}): Promise<TikTokBcAdvertiser[]> {
  if (input?.forceRefresh) {
    return listHolisticBcAdvertisers(input);
  }
  const cached = peekHolisticBcAdvertisersCache();
  if (cached) {
    // Refresh en background si la cache está vieja (>1 min)
    const hit = cache.get("holistic-bcs");
    if (hit && Date.now() - hit.at > 60_000) {
      warmHolisticBcAdvertisers(input);
    }
    return cached;
  }
  // Cold: no bloquear page load; calentar para la siguiente visita
  warmHolisticBcAdvertisers(input);
  return [];
}

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function classifyTikTokAdvertiserStatus(
  status?: string | null,
): TikTokBcAdvertiserStatusKind {
  const st = String(status ?? "").toUpperCase();
  if (!st) return "unknown";
  // Cerradas / castigadas / rechazadas (STATUS_LIMIT = “usuario castigado” en TikTok).
  if (
    /SUSPEND|DISABLE|REJECT|PUNISH|BAN|CLOSE|\bLIMIT\b|CONFIRM_FAIL|CONFIRM_MODIFY_FAIL/.test(
      st,
    )
  ) {
    return "suspended";
  }
  if (
    /ENABLE|ACTIVE|APPROVE|STATUS_OK|STATUS_ENABLE|STATUS_APPROVED/.test(st) ||
    st === "OK"
  ) {
    return "approved";
  }
  return "unknown";
}

export function isTikTokAdvertiserFundable(
  status?: string | null,
): boolean {
  return classifyTikTokAdvertiserStatus(status) === "approved";
}

function resolveBcIds(): string[] {
  const fromEnv = serverEnv.tiktokDefaultBcId.trim();
  const ids = new Set<string>();
  if (fromEnv) ids.add(fromEnv);
  for (const id of DEFAULT_HOLISTIC_BC_IDS) ids.add(id);
  return [...ids];
}

function extractList(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const nested = (d.data ?? d) as Record<string, unknown>;
  for (const key of ["list", "assets", "advertisers", "bc_list"] as const) {
    const value = nested[key];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
  }
  return [];
}

function parseAssetRow(
  row: Record<string, unknown>,
  bcId: string,
): TikTokBcAdvertiser | null {
  const info =
    (row.advertiser_info as Record<string, unknown> | undefined) ||
    (row.asset_info as Record<string, unknown> | undefined) ||
    (row.bc_info as Record<string, unknown> | undefined) ||
    row;
  const advertiserId = String(
    info.advertiser_id ??
      info.asset_id ??
      row.advertiser_id ??
      row.asset_id ??
      info.id ??
      "",
  ).trim();
  if (!/^\d{10,19}$/.test(advertiserId)) return null;

  const advertiserName = String(
    info.advertiser_name ??
      info.asset_name ??
      info.name ??
      row.advertiser_name ??
      row.asset_name ??
      row.name ??
      "",
  ).trim();

  const statusRaw =
    info.status ??
    info.advertiser_status ??
    row.status ??
    row.asset_status ??
    info.audit_status ??
    null;

  const status =
    statusRaw != null && String(statusRaw).trim()
      ? String(statusRaw)
      : null;

  return {
    advertiserId,
    advertiserName,
    statusRaw: status,
    statusKind: classifyTikTokAdvertiserStatus(status),
    bcId,
  };
}

async function tiktokGet(
  path: string,
  accessToken: string,
  query: Record<string, string | number>,
): Promise<TikTokApiResponse<Record<string, unknown>>> {
  const url = new URL(apiUrl(path));
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, String(v));
  }
  const response = await fetch(url.toString(), {
    headers: { "Access-Token": accessToken, Accept: "application/json" },
    cache: "no-store",
  });
  const json = (await response.json()) as TikTokApiResponse<Record<string, unknown>>;
  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.message ?? `TikTok HTTP ${response.status}`);
  }
  return json;
}

async function listBcAdvertisersAtPath(
  accessToken: string,
  bcId: string,
  apiPath: string,
): Promise<TikTokBcAdvertiser[]> {
  const all: TikTokBcAdvertiser[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 40) {
    const json = await tiktokGet(apiPath, accessToken, {
      bc_id: bcId,
      asset_type: "ADVERTISER",
      page,
      page_size: 50,
    });
    const chunk = extractList(json);
    for (const row of chunk) {
      const parsed = parseAssetRow(row, bcId);
      if (parsed) all.push(parsed);
    }
    const pageInfo =
      (json.data?.page_info as { total_page?: number } | undefined) ?? {};
    totalPages = Number(pageInfo.total_page ?? 1) || 1;
    if (!chunk.length) break;
    page += 1;
  }
  return all;
}

async function listBcAdvertisers(
  accessToken: string,
  bcId: string,
): Promise<TikTokBcAdvertiser[]> {
  const paths = ["/bc/asset/admin/get/", "/bc/asset/get/"];
  let lastError: Error | null = null;
  for (const path of paths) {
    try {
      const rows = await listBcAdvertisersAtPath(accessToken, bcId, path);
      if (rows.length) return rows;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  if (lastError) throw lastError;
  return [];
}

/**
 * Lista advertisers de los BM Holistic con estado TikTok (cache 5 min).
 */
export async function listHolisticBcAdvertisers(input?: {
  organizationId?: string;
  forceRefresh?: boolean;
}): Promise<TikTokBcAdvertiser[]> {
  const cacheKey = "holistic-bcs";
  const hit = cache.get(cacheKey);
  if (!input?.forceRefresh && hit && Date.now() - hit.at < CACHE_MS) {
    return hit.advertisers;
  }

  const { token } = await resolveTikTokFinanceAccessToken(input?.organizationId);
  const bcIds = resolveBcIds();
  const byId = new Map<string, TikTokBcAdvertiser>();

  const batches = await Promise.all(
    bcIds.map(async (bcId) => {
      try {
        return await listBcAdvertisers(token, bcId);
      } catch (error) {
        console.warn("[tiktok-bc] list_advertisers_failed", {
          bcId,
          error: error instanceof Error ? error.message : "unknown",
        });
        return [] as TikTokBcAdvertiser[];
      }
    }),
  );

  for (const rows of batches) {
    for (const row of rows) {
      const prev = byId.get(row.advertiserId);
      if (!prev) {
        byId.set(row.advertiserId, row);
        continue;
      }
      // Preferir estado más “útil”: suspended > approved > unknown
      // (antes solo ganaba approved y se perdían baneadas).
      const rank = (k: TikTokBcAdvertiserStatusKind) =>
        k === "suspended" ? 3 : k === "approved" ? 2 : 1;
      if (rank(row.statusKind) >= rank(prev.statusKind)) {
        byId.set(row.advertiserId, row);
      }
    }
  }

  const advertisers = [...byId.values()];
  // Nunca cachear vacío: un fail intermitente dejaba a gerentes sin Asignar 5 min
  // mientras super admin seguía viendo filas ya upsertadas en su org.
  if (advertisers.length > 0) {
    cache.set(cacheKey, { at: Date.now(), advertisers });
  } else {
    cache.delete(cacheKey);
  }
  console.info("[tiktok-bc] list_advertisers_ok", {
    count: advertisers.length,
    approved: advertisers.filter((a) => a.statusKind === "approved").length,
    suspended: advertisers.filter((a) => a.statusKind === "suspended").length,
  });
  return advertisers;
}

export function resolveBcIdForHecomBucket(
  bmBucket: string | null | undefined,
  fallbackBcId?: string | null,
): string {
  const bucket = String(bmBucket ?? "").trim();
  if (bucket && HECOM_BM_BUCKET_TO_BC[bucket]) {
    return HECOM_BM_BUCKET_TO_BC[bucket];
  }
  return (
    fallbackBcId?.trim() ||
    serverEnv.tiktokDefaultBcId.trim() ||
    HECOM_BM_BUCKET_TO_BC["200"]
  );
}
