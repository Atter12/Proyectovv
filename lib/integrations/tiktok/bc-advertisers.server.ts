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

/** BC ID TikTok → bm_bucket Hecom ("10" | "30" | "200"). */
export function resolveBmBucketFromBcId(bcId: string | null | undefined): string | null {
  const id = String(bcId ?? "").trim();
  if (!id) return null;
  for (const [bucket, mapped] of Object.entries(HECOM_BM_BUCKET_TO_BC)) {
    if (mapped === id) return bucket;
  }
  return null;
}

function advertiserStatusRank(kind: TikTokBcAdvertiserStatusKind): number {
  return kind === "suspended" ? 3 : kind === "approved" ? 2 : 1;
}

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
  // Ojo: no usar \bLIMIT\b — en JS "_" es word-char y STATUS_LIMIT no matchea.
  if (
    /SUSPEND|DISABLE|REJECT|PUNISH|BAN|CLOSE|LIMIT|CONFIRM_FAIL|CONFIRM_MODIFY_FAIL/.test(
      st,
    )
  ) {
    return "suspended";
  }
  // SHOW_STATUS / advertiser_status “habilitada”
  if (
    /ENABLE|ACTIVE|APPROVE|STATUS_OK|STATUS_ENABLE|STATUS_APPROVED|SHOW_STATUS_APPROVED|STATUS_BOUND/.test(
      st,
    ) ||
    st === "OK" ||
    st === "APPROVED"
  ) {
    return "approved";
  }
  return "unknown";
}

/**
 * El campo `status` del asset suele ser relación BM↔cuenta (casi siempre ENABLE).
 * El ban/castigo viene en advertiser_show_status / advertiser_status.
 * Si hay varios campos, preferimos el más “grave” (suspendida > activa > unknown).
 */
function pickAdvertiserStatusRaw(
  row: Record<string, unknown>,
  info: Record<string, unknown>,
): string | null {
  const candidates = [
    info.advertiser_show_status,
    row.advertiser_show_status,
    info.advertiser_status,
    row.advertiser_status,
    info.show_status,
    row.show_status,
    info.account_status,
    row.account_status,
    info.status,
    row.status,
    row.asset_status,
    info.audit_status,
  ]
    .map((value) => (value == null ? null : String(value).trim()))
    .filter((value): value is string => Boolean(value));

  if (!candidates.length) return null;

  const rank = (status: string) => {
    const kind = classifyTikTokAdvertiserStatus(status);
    if (kind === "suspended") return 3;
    if (kind === "approved") return 2;
    return 1;
  };

  let best = candidates[0]!;
  for (const candidate of candidates.slice(1)) {
    if (rank(candidate) > rank(best)) best = candidate;
  }
  return best;
}

function resolveBcIds(): string[] {
  const fromEnv = serverEnv.tiktokDefaultBcId.trim();
  const ids = new Set<string>();
  if (fromEnv) ids.add(fromEnv);
  for (const id of DEFAULT_HOLISTIC_BC_IDS) ids.add(id);
  return [...ids];
}

export function isTikTokAdvertiserFundable(
  status?: string | null,
): boolean {
  return classifyTikTokAdvertiserStatus(status) === "approved";
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

  const statusRaw = pickAdvertiserStatusRaw(row, info);

  return {
    advertiserId,
    advertiserName,
    statusRaw,
    statusKind: classifyTikTokAdvertiserStatus(statusRaw),
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
  filtering?: Record<string, string>,
): Promise<TikTokBcAdvertiser[]> {
  const all: TikTokBcAdvertiser[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 40) {
    const query: Record<string, string | number> = {
      bc_id: bcId,
      asset_type: "ADVERTISER",
      page,
      page_size: 50,
    };
    if (filtering && Object.keys(filtering).length > 0) {
      query.filtering = JSON.stringify(filtering);
    }
    const json = await tiktokGet(apiPath, accessToken, query);
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

/** Status de cuenta que suelen ser baneadas/castigadas (filtro TikTok). */
const SUSPENDED_SHOW_STATUSES = [
  "STATUS_LIMIT",
  "STATUS_DISABLE",
  "STATUS_CONFIRM_FAIL",
  "STATUS_CONFIRM_FAIL_END",
  "STATUS_CLOSE",
] as const;

async function listBcAdvertisers(
  accessToken: string,
  bcId: string,
): Promise<TikTokBcAdvertiser[]> {
  const paths = ["/bc/asset/admin/get/", "/bc/asset/get/"];
  let lastError: Error | null = null;
  let base: TikTokBcAdvertiser[] = [];

  for (const path of paths) {
    try {
      const rows = await listBcAdvertisersAtPath(accessToken, bcId, path);
      if (rows.length) {
        base = rows;
        break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (!base.length) {
    if (lastError) throw lastError;
    return [];
  }

  // TikTok a veces no marca bien el ban en el listado “all”. Traemos por show_status.
  const byId = new Map(base.map((row) => [row.advertiserId, row]));
  const path = "/bc/asset/admin/get/";
  await Promise.all(
    SUSPENDED_SHOW_STATUSES.map(async (showStatus) => {
      try {
        const rows = await listBcAdvertisersAtPath(accessToken, bcId, path, {
          advertiser_show_status: showStatus,
        });
        for (const row of rows) {
          // Forzar kind suspended aunque el parse haya leído mal el campo.
          byId.set(row.advertiserId, {
            ...row,
            statusRaw: row.statusRaw ?? showStatus,
            statusKind: "suspended",
          });
        }
      } catch {
        // filtro no soportado / sin resultados
      }
    }),
  );

  return [...byId.values()];
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
    unknown: advertisers.filter((a) => a.statusKind === "unknown").length,
    sampleStatusRaw: [...new Set(advertisers.map((a) => a.statusRaw ?? "(null)"))]
      .slice(0, 12),
  });
  return advertisers;
}

/**
 * Busca en BM por keyword + show_status (p.ej. baneadas de un cliente).
 * Complementa el listado completo cuando el nombre no matchea bien.
 */
export async function searchHolisticBcAdvertisers(input: {
  keyword: string;
  organizationId?: string;
  showStatuses?: string[];
}): Promise<TikTokBcAdvertiser[]> {
  const keyword = input.keyword.trim();
  if (keyword.length < 3) return [];

  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);
  const bcIds = resolveBcIds();
  const statuses =
    input.showStatuses?.length ? input.showStatuses : [...SUSPENDED_SHOW_STATUSES];
  const byId = new Map<string, TikTokBcAdvertiser>();

  await Promise.all(
    bcIds.flatMap((bcId) =>
      statuses.map(async (showStatus) => {
        try {
          const rows = await listBcAdvertisersAtPath(
            token,
            bcId,
            "/bc/asset/admin/get/",
            {
              keyword,
              advertiser_show_status: showStatus,
            },
          );
          for (const row of rows) {
            byId.set(row.advertiserId, {
              ...row,
              statusRaw: row.statusRaw ?? showStatus,
              statusKind: "suspended",
            });
          }
        } catch {
          // BM sin permiso / filtro vacío
        }
      }),
    ),
  );

  return [...byId.values()];
}

/**
 * Busca advertisers por keyword en los 3 BM (aprobadas + suspendidas).
 * Complementa el listado paginado cuando una cuenta no entra en las primeras páginas.
 */
export async function searchHolisticBcAdvertisersByKeyword(input: {
  keyword: string;
  organizationId?: string;
}): Promise<TikTokBcAdvertiser[]> {
  const keyword = input.keyword.trim();
  if (keyword.length < 3) return [];

  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);
  const bcIds = resolveBcIds();
  const byId = new Map<string, TikTokBcAdvertiser>();

  await Promise.all(
    bcIds.map(async (bcId) => {
      try {
        const rows = await listBcAdvertisersAtPath(
          token,
          bcId,
          "/bc/asset/admin/get/",
          { keyword },
        );
        for (const row of rows) {
          const prev = byId.get(row.advertiserId);
          if (
            !prev ||
            advertiserStatusRank(row.statusKind) >=
              advertiserStatusRank(prev.statusKind)
          ) {
            byId.set(row.advertiserId, row);
          }
        }
      } catch {
        // BM sin permiso / filtro vacío
      }
    }),
  );

  return [...byId.values()];
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
