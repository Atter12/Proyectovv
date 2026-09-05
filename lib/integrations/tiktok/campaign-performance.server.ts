import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";

interface TikTokApiResponse<T> {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
}

export type TikTokCampaignPerfRow = {
  advertiserId: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  /** CTR en % (ej. 1.25 = 1.25%). */
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number | null;
  costPerConversion: number | null;
};

export type TikTokCampaignPerfBundle = {
  rows: TikTokCampaignPerfRow[];
  fetchedAt: string;
  advertisersQueried: number;
  advertisersOk: number;
  error: string | null;
};

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

async function fetchOneAdvertiserCampaignPerf(input: {
  advertiserId: string;
  accessToken: string;
  from: string;
  to: string;
}): Promise<TikTokCampaignPerfRow[]> {
  const attempts: Array<{ dimensions: string[]; metrics: string[] }> = [
    {
      dimensions: ["campaign_id", "campaign_name"],
      metrics: [
        "spend",
        "impressions",
        "clicks",
        "ctr",
        "cpc",
        "cpm",
        "conversion",
        "cost_per_conversion",
      ],
    },
    {
      dimensions: ["campaign_id"],
      metrics: [
        "spend",
        "impressions",
        "clicks",
        "ctr",
        "cpc",
        "cpm",
        "conversion",
        "cost_per_conversion",
      ],
    },
    {
      dimensions: ["campaign_id"],
      metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "cpm"],
    },
  ];

  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      const url = new URL(apiUrl("/report/integrated/get/"));
      url.searchParams.set("advertiser_id", input.advertiserId);
      url.searchParams.set("service_type", "AUCTION");
      url.searchParams.set("report_type", "BASIC");
      url.searchParams.set("data_level", "AUCTION_CAMPAIGN");
      url.searchParams.set("dimensions", JSON.stringify(attempt.dimensions));
      url.searchParams.set("metrics", JSON.stringify(attempt.metrics));
      url.searchParams.set("start_date", input.from);
      url.searchParams.set("end_date", input.to);
      url.searchParams.set("page", "1");
      url.searchParams.set("page_size", "200");
      url.searchParams.set("order_field", "spend");
      url.searchParams.set("order_type", "DESC");

      const response = await fetch(url.toString(), {
        headers: { "Access-Token": input.accessToken },
        cache: "no-store",
      });
      const json = (await response.json()) as TikTokApiResponse<{
        list?: Array<{
          dimensions?: Record<string, unknown>;
          metrics?: Record<string, unknown>;
        }>;
      }>;

      if (!response.ok || (json.code !== undefined && json.code !== 0)) {
        lastError = new Error(json.message ?? "Report campaña TikTok falló.");
        continue;
      }

      return parseCampaignList(input.advertiserId, json.data?.list ?? []);
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Report campaña falló.");
    }
  }

  throw lastError ?? new Error("Report campaña TikTok falló.");
}

function parseCampaignList(
  advertiserId: string,
  list: Array<{
    dimensions?: Record<string, unknown>;
    metrics?: Record<string, unknown>;
  }>,
): TikTokCampaignPerfRow[] {
  const rows: TikTokCampaignPerfRow[] = [];
  for (const row of list) {
    const campaignId = String(
      row.dimensions?.campaign_id ?? row.metrics?.campaign_id ?? "",
    ).trim();
    if (!campaignId) continue;
    const spend = num(row.metrics?.spend) ?? 0;
    const impressions = num(row.metrics?.impressions) ?? 0;
    const clicks = num(row.metrics?.clicks) ?? 0;
    if (spend <= 0 && impressions <= 0 && clicks <= 0) continue;

    const name = String(
      row.metrics?.campaign_name ??
        row.dimensions?.campaign_name ??
        campaignId,
    ).trim();

    rows.push({
      advertiserId,
      campaignId,
      campaignName: name || campaignId,
      spend: round2(spend),
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      ctr: num(row.metrics?.ctr),
      cpc: num(row.metrics?.cpc) != null ? round2(num(row.metrics?.cpc)!) : null,
      cpm: num(row.metrics?.cpm) != null ? round2(num(row.metrics?.cpm)!) : null,
      conversions: num(row.metrics?.conversion),
      costPerConversion:
        num(row.metrics?.cost_per_conversion) != null
          ? round2(num(row.metrics?.cost_per_conversion)!)
          : null,
    });
  }
  return rows;
}

/**
 * Performance BASIC a nivel campaña para varios advertisers.
 * Best-effort: errores parciales no tumban el bundle.
 */
export async function fetchCampaignPerformanceForAdvertisers(input: {
  advertiserIds: string[];
  from: string;
  to: string;
  /** Cap para no saturar TikTok (default 12). */
  maxAdvertisers?: number;
}): Promise<TikTokCampaignPerfBundle> {
  const fetchedAt = new Date().toISOString();
  const ids = [
    ...new Set(input.advertiserIds.map((id) => id.trim()).filter(Boolean)),
  ].slice(0, input.maxAdvertisers ?? 12);

  if (ids.length === 0) {
    return {
      rows: [],
      fetchedAt,
      advertisersQueried: 0,
      advertisersOk: 0,
      error: null,
    };
  }

  let token: string;
  try {
    ({ token } = await resolveTikTokFinanceAccessToken());
  } catch (error) {
    return {
      rows: [],
      fetchedAt,
      advertisersQueried: ids.length,
      advertisersOk: 0,
      error:
        error instanceof Error
          ? error.message
          : "Sin token TikTok para reportes.",
    };
  }

  const settled = await mapPool(ids, 3, async (advertiserId) => {
    try {
      const rows = await fetchOneAdvertiserCampaignPerf({
        advertiserId,
        accessToken: token,
        from: input.from,
        to: input.to,
      });
      return { ok: true as const, advertiserId, rows };
    } catch (error) {
      return {
        ok: false as const,
        advertiserId,
        error:
          error instanceof Error ? error.message : "Error report campaña",
        rows: [] as TikTokCampaignPerfRow[],
      };
    }
  });

  const rows: TikTokCampaignPerfRow[] = [];
  let advertisersOk = 0;
  const errors: string[] = [];
  for (const item of settled) {
    if (item.ok) {
      advertisersOk += 1;
      rows.push(...item.rows);
    } else if (item.error) {
      errors.push(`${item.advertiserId}: ${item.error}`);
    }
  }

  rows.sort((a, b) => b.spend - a.spend);

  return {
    rows,
    fetchedAt,
    advertisersQueried: ids.length,
    advertisersOk,
    error:
      advertisersOk === 0 && errors.length > 0
        ? errors[0] ?? "Sin datos de performance TikTok."
        : null,
  };
}
