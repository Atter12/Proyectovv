import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";

interface TikTokApiResponse<T> {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
}

export type AdvertiserLiveMetrics = {
  advertiserId: string;
  balanceUsd: number | null;
  spendTodayUsd: number | null;
  fetchedAt: string;
  error?: string;
};

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function parseUsd(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function pickBalanceUsd(row: Record<string, unknown>): number | null {
  return (
    parseUsd(row.account_balance) ??
    parseUsd(row.valid_account_balance) ??
    parseUsd(row.cash_balance) ??
    parseUsd(row.balance) ??
    parseUsd(row.available_balance)
  );
}

function todayLimaYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function fetchAdvertiserBalancesForBc(input: {
  bcId: string;
  advertiserIds: string[];
}): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (input.advertiserIds.length === 0) return result;

  const { token } = await resolveTikTokFinanceAccessToken();
  const url = new URL(apiUrl("/advertiser/balance/get/"));
  url.searchParams.set("bc_id", input.bcId.trim());
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "50");
  url.searchParams.set(
    "filtering",
    JSON.stringify({ advertiser_ids: input.advertiserIds }),
  );

  const response = await fetch(url.toString(), {
    headers: { "Access-Token": token },
    cache: "no-store",
  });
  const json = (await response.json()) as TikTokApiResponse<{
    list?: Array<Record<string, unknown>>;
    advertiser_account_list?: Array<Record<string, unknown>>;
  }>;

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.message ?? "No se pudo leer saldo TikTok.");
  }

  const rows =
    json.data?.list ??
    json.data?.advertiser_account_list ??
    [];

  for (const row of rows) {
    const advertiserId = String(
      row.advertiser_id ?? row.advertiserId ?? "",
    ).trim();
    if (!advertiserId) continue;
    const balance = pickBalanceUsd(row);
    if (balance != null) result.set(advertiserId, balance);
  }

  return result;
}

async function fetchAdvertiserSpendForDate(input: {
  advertiserId: string;
  date: string;
}): Promise<number | null> {
  const { token } = await resolveTikTokFinanceAccessToken();
  const url = new URL(apiUrl("/report/integrated/get/"));
  url.searchParams.set("advertiser_id", input.advertiserId);
  url.searchParams.set("service_type", "AUCTION");
  url.searchParams.set("report_type", "BASIC");
  url.searchParams.set("data_level", "AUCTION_ADVERTISER");
  url.searchParams.set(
    "dimensions",
    JSON.stringify(["advertiser_id", "stat_time_day"]),
  );
  url.searchParams.set("metrics", JSON.stringify(["spend"]));
  url.searchParams.set("start_date", input.date);
  url.searchParams.set("end_date", input.date);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "10");

  const response = await fetch(url.toString(), {
    headers: { "Access-Token": token },
    cache: "no-store",
  });
  const json = (await response.json()) as TikTokApiResponse<{
    list?: Array<{
      metrics?: { spend?: number | string };
    }>;
  }>;

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    return null;
  }

  const spend = Number(json.data?.list?.[0]?.metrics?.spend ?? 0);
  return Number.isFinite(spend) ? Math.round(spend * 100) / 100 : 0;
}

export async function fetchAdvertiserLiveMetrics(input: {
  bcId: string;
  advertiserIds: string[];
}): Promise<AdvertiserLiveMetrics[]> {
  const ids = [...new Set(input.advertiserIds.map((id) => id.trim()).filter(Boolean))];
  const fetchedAt = new Date().toISOString();
  const today = todayLimaYmd();

  if (ids.length === 0) return [];

  let balances = new Map<string, number>();
  try {
    balances = await fetchAdvertiserBalancesForBc({
      bcId: input.bcId,
      advertiserIds: ids,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de saldo";
    return ids.map((advertiserId) => ({
      advertiserId,
      balanceUsd: null,
      spendTodayUsd: null,
      fetchedAt,
      error: message,
    }));
  }

  const spendResults = await Promise.all(
    ids.map(async (advertiserId) => {
      try {
        const spend = await fetchAdvertiserSpendForDate({
          advertiserId,
          date: today,
        });
        return { advertiserId, spend };
      } catch {
        return { advertiserId, spend: null as number | null };
      }
    }),
  );

  const spendById = new Map(
    spendResults.map((row) => [row.advertiserId, row.spend]),
  );

  return ids.map((advertiserId) => ({
    advertiserId,
    balanceUsd: balances.get(advertiserId) ?? null,
    spendTodayUsd: spendById.get(advertiserId) ?? null,
    fetchedAt,
  }));
}
