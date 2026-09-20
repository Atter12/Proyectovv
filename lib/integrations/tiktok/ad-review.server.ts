import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";

type TikTokApiResponse<T> = {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
};

export type TikTokAdReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "unknown";

export type TikTokAdReviewSnapshot = {
  adId: string;
  reviewStatus: TikTokAdReviewStatus;
  rejectReasons: string[];
  secondaryStatus: string | null;
  isApproved: boolean | null;
};

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function tiktokGet<T>(input: {
  path: string;
  accessToken: string;
  query: Record<string, string>;
}): Promise<TikTokApiResponse<T>> {
  const url = new URL(apiUrl(input.path));
  for (const [key, value] of Object.entries(input.query)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Access-Token": input.accessToken,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  return (await response.json()) as TikTokApiResponse<T>;
}

function pushReason(out: string[], value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) out.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) pushReason(out, item);
    return;
  }
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    for (const key of [
      "reason",
      "reasons",
      "reason_text",
      "reject_reason",
      "reject_reason_tips",
      "suggestion",
      "suggestions",
      "forbidden_content",
      "forbidden_words",
      "policy_text",
      "policy_title",
      "content",
      "description",
      "msg",
      "message",
      "detail",
      "details",
    ]) {
      if (row[key] != null) pushReason(out, row[key]);
    }
  }
}

function extractRejectReasons(value: unknown): string[] {
  const out: string[] = [];
  pushReason(out, value);
  return [...new Set(out)].slice(0, 12);
}

function normalizeReviewStatus(input: {
  isApproved: boolean | null;
  rejectReasons: string[];
  reviewStatusRaw: string | null;
}): TikTokAdReviewStatus {
  const raw = (input.reviewStatusRaw ?? "").toUpperCase();
  if (
    /AUDIT_DENY|PARTIAL_AUDIT|REVIEW_REJECT|REJECT|DENY|FAIL|UNAVAILABLE|NOT_APPROVE|NOT_PASS|DISAPPROVE|PUNISH/.test(
      raw,
    ) ||
    input.rejectReasons.length > 0
  ) {
    if (input.isApproved === true && input.rejectReasons.length === 0) {
      return "approved";
    }
    return "rejected";
  }
  if (
    input.isApproved === true ||
    /APPROVE|PASS|AVAILABLE|OK/.test(raw)
  ) {
    return "approved";
  }
  if (
    input.isApproved === false ||
    /PENDING|REVIEW|PROCESSING|IN_REVIEW/.test(raw)
  ) {
    return "pending";
  }
  if (input.isApproved === false) return "rejected";
  return "unknown";
}

/**
 * Motivos de rechazo / estado de review a nivel anuncio (no cuenta).
 * GET /open_api/v1.3/ad/review_info/
 */
export async function fetchAdReviewInfo(input: {
  organizationId?: string;
  advertiserId: string;
  adIds: string[];
  lang?: string;
}): Promise<Map<string, TikTokAdReviewSnapshot>> {
  const advertiserId = input.advertiserId.trim();
  const adIds = [
    ...new Set(
      input.adIds.map((id) => String(id ?? "").trim()).filter(Boolean),
    ),
  ];
  const out = new Map<string, TikTokAdReviewSnapshot>();
  if (!advertiserId || adIds.length === 0) return out;

  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);

  for (let i = 0; i < adIds.length; i += 100) {
    const chunk = adIds.slice(i, i + 100);
    const json = await tiktokGet<Record<string, unknown>>({
      path: "/ad/review_info/",
      accessToken: token,
      query: {
        advertiser_id: advertiserId,
        ad_ids: JSON.stringify(chunk),
        lang: input.lang ?? "es",
      },
    });

    if (json.code !== undefined && json.code !== 0) {
      throw new Error(
        json.message ?? `TikTok ad/review_info falló (code=${json.code}).`,
      );
    }

    const data = (json.data ?? {}) as Record<string, unknown>;
    // Formas vistas en docs: list[], ad_review_map{}, o mapa ad_id → info
    const list = Array.isArray(data.list)
      ? (data.list as Record<string, unknown>[])
      : null;
    const mapCandidate =
      (data.ad_review_map as Record<string, unknown> | undefined) ??
      (data.review_map as Record<string, unknown> | undefined) ??
      data;

    const rows: Array<{ adId: string; row: Record<string, unknown> }> = [];
    if (list) {
      for (const row of list) {
        const adId = String(row.ad_id ?? row.id ?? "").trim();
        if (adId) rows.push({ adId, row });
      }
    } else if (mapCandidate && typeof mapCandidate === "object") {
      for (const [key, value] of Object.entries(mapCandidate)) {
        if (!value || typeof value !== "object") continue;
        if (key === "list" || key === "page_info") continue;
        const row = value as Record<string, unknown>;
        const adId = String(row.ad_id ?? row.id ?? key).trim();
        if (adId) rows.push({ adId, row });
      }
    }

    for (const { adId, row } of rows) {
      const isApprovedRaw = row.is_approved ?? row.is_pass;
      const isApproved =
        typeof isApprovedRaw === "boolean"
          ? isApprovedRaw
          : typeof isApprovedRaw === "string"
            ? /^(true|1|yes|pass)$/i.test(isApprovedRaw)
            : null;
      const rejectReasons = extractRejectReasons(
        row.reject_info ?? row.reject_reasons ?? row.rejection_info,
      );
      const reviewStatusRaw = String(
        row.review_status ?? row.status ?? row.audit_status ?? "",
      ).trim() || null;
      const reviewStatus = normalizeReviewStatus({
        isApproved,
        rejectReasons,
        reviewStatusRaw,
      });

      out.set(adId, {
        adId,
        reviewStatus,
        rejectReasons,
        secondaryStatus: null,
        isApproved,
      });
    }
  }

  return out;
}

/**
 * secondary_status del anuncio (ej. problema de revisión / entrega parcial).
 * GET /open_api/v1.3/ad/get/
 */
export async function fetchAdSecondaryStatuses(input: {
  organizationId?: string;
  advertiserId: string;
  adIds: string[];
}): Promise<Map<string, string | null>> {
  const advertiserId = input.advertiserId.trim();
  const adIds = [
    ...new Set(
      input.adIds.map((id) => String(id ?? "").trim()).filter(Boolean),
    ),
  ];
  const out = new Map<string, string | null>();
  if (!advertiserId || adIds.length === 0) return out;

  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);

  for (let i = 0; i < adIds.length; i += 100) {
    const chunk = adIds.slice(i, i + 100);
    try {
      const json = await tiktokGet<{
        list?: Array<Record<string, unknown>>;
      }>({
        path: "/ad/get/",
        accessToken: token,
        query: {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ ad_ids: chunk }),
          fields: JSON.stringify([
            "ad_id",
            "secondary_status",
            "operation_status",
          ]),
          page: "1",
          page_size: String(Math.min(100, chunk.length)),
        },
      });
      if (json.code !== undefined && json.code !== 0) continue;
      for (const row of json.data?.list ?? []) {
        const adId = String(row.ad_id ?? "").trim();
        if (!adId) continue;
        const secondary = row.secondary_status;
        out.set(
          adId,
          typeof secondary === "string" && secondary.trim()
            ? secondary.trim()
            : null,
        );
      }
    } catch (error) {
      console.warn("[tiktok-ad-review] ad_get_secondary_failed", {
        advertiserId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return out;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Review de anuncios Upgraded Smart+ (Ads Manager moderno).
 * GET /open_api/v1.3/smart_plus/ad/review_info/
 */
export async function fetchSmartPlusAdReviewInfo(input: {
  organizationId?: string;
  advertiserId: string;
  smartPlusAdIds: string[];
  lang?: string;
}): Promise<Map<string, TikTokAdReviewSnapshot>> {
  const advertiserId = input.advertiserId.trim();
  const smartPlusAdIds = [
    ...new Set(
      input.smartPlusAdIds.map((id) => String(id ?? "").trim()).filter(Boolean),
    ),
  ];
  const out = new Map<string, TikTokAdReviewSnapshot>();
  if (!advertiserId || smartPlusAdIds.length === 0) return out;

  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);

  for (let i = 0; i < smartPlusAdIds.length; i += 10) {
    if (i > 0) await sleep(1200);
    const chunk = smartPlusAdIds.slice(i, i + 10);
    let json: TikTokApiResponse<Record<string, unknown>> | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      json = await tiktokGet<Record<string, unknown>>({
        path: "/smart_plus/ad/review_info/",
        accessToken: token,
        query: {
          advertiser_id: advertiserId,
          smart_plus_ad_ids: JSON.stringify(chunk),
          lang: input.lang ?? "es",
        },
      });
      if (json.code === 0) break;
      if (/OVER_QPS|RATE|LIMIT/i.test(String(json.message ?? ""))) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      break;
    }
    if (!json || (json.code !== undefined && json.code !== 0)) {
      throw new Error(
        json?.message ??
          `TikTok smart_plus/ad/review_info falló (code=${json?.code}).`,
      );
    }

    const data = (json.data ?? {}) as Record<string, unknown>;
    const adInfos = Array.isArray(data.smart_plus_ad_review_infos)
      ? (data.smart_plus_ad_review_infos as Record<string, unknown>[])
      : [];
    const materialInfos = Array.isArray(data.material_review_infos)
      ? (data.material_review_infos as Record<string, unknown>[])
      : [];

    const bySp = new Map<
      string,
      { reasons: string[]; rejected: boolean; statuses: string[] }
    >();

    for (const row of adInfos) {
      const spId = String(row.smart_plus_ad_id ?? "").trim();
      if (!spId) continue;
      const cur = bySp.get(spId) ?? {
        reasons: [],
        rejected: false,
        statuses: [],
      };
      const status = String(row.review_status ?? "").trim();
      if (status) cur.statuses.push(status);
      cur.reasons.push(
        ...extractRejectReasons(row.reject_info ?? row.appeal_reject_reasons),
      );
      if (/UNAVAILABLE|REJECT|DENY|FAIL|NOT_APPROVE|PARTIAL_AUDIT|PUNISH|NOT_PASS|DISAPPROVE/i.test(status)) {
        cur.rejected = true;
      }
      bySp.set(spId, cur);
    }

    for (const row of materialInfos) {
      const spId = String(row.smart_plus_ad_id ?? "").trim();
      if (!spId) continue;
      const cur = bySp.get(spId) ?? {
        reasons: [],
        rejected: false,
        statuses: [],
      };
      const status = String(row.review_status ?? "").trim();
      if (status) cur.statuses.push(status);
      cur.reasons.push(...extractRejectReasons(row.reject_info));
      if (/UNAVAILABLE|REJECT|DENY|FAIL|NOT_APPROVE|PARTIAL_AUDIT|PUNISH|NOT_PASS|DISAPPROVE/i.test(status)) {
        cur.rejected = true;
      }
      bySp.set(spId, cur);
    }

    for (const [spId, cur] of bySp) {
      const rejectReasons = [...new Set(cur.reasons)].slice(0, 12);
      if (cur.rejected && rejectReasons.length === 0) {
        rejectReasons.push(
          "TikTok sacó este anuncio del aire y no dejó el motivo detallado (video borrado, expirado o rechazado).",
        );
      }
      out.set(spId, {
        adId: spId,
        reviewStatus: cur.rejected
          ? "rejected"
          : /AVAILABLE|APPROVE|PASS/i.test(cur.statuses.join("|"))
            ? "approved"
            : "pending",
        rejectReasons,
        secondaryStatus: cur.statuses[0] ?? null,
        isApproved: cur.rejected ? false : true,
      });
    }
  }

  return out;
}
