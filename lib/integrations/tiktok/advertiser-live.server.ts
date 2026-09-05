import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import {
  pickBudgetLimitSnapshot,
  pickSpendableBudgetUsd,
  type AdvertiserBudgetLimitSnapshot,
} from "@/lib/integrations/tiktok/spendable-budget.shared";

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
  paymentPortfolioType: string | null;
  budgetMode: string | null;
  budgetUsd: number | null;
  budgetCostUsd: number | null;
  showBudgetLimit: boolean;
  isUnlimitedBudget: boolean;
};

type AdvertiserBalanceRow = {
  balanceUsd: number | null;
  limit: AdvertiserBudgetLimitSnapshot;
};

function emptyLimit(): AdvertiserBudgetLimitSnapshot {
  return {
    paymentPortfolioType: null,
    budgetMode: null,
    budgetUsd: null,
    budgetCostUsd: null,
    showBudgetLimit: false,
    isUnlimited: false,
  };
}

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function todayLimaYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOneAdvertiserBalanceOnce(input: {
  bcId: string;
  advertiserId: string;
  accessToken: string;
}): Promise<AdvertiserBalanceRow> {
  const url = new URL(apiUrl("/advertiser/balance/get/"));
  url.searchParams.set("bc_id", input.bcId.trim());
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "20");
  // `advertiser_ids` en filtering NO filtra en BMs grandes (devuelve pág. 1
  // genérica). `keyword` sí encuentra la cuenta por ID.
  url.searchParams.set(
    "filtering",
    JSON.stringify({ keyword: input.advertiserId.trim() }),
  );

  const response = await fetch(url.toString(), {
    headers: { "Access-Token": input.accessToken },
    cache: "no-store",
  });
  const json = (await response.json()) as TikTokApiResponse<{
    list?: Array<Record<string, unknown>>;
    advertiser_account_list?: Array<Record<string, unknown>>;
  }>;

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.message ?? "No se pudo leer saldo TikTok.");
  }

  const want = input.advertiserId.trim();
  const rows =
    json.data?.list ?? json.data?.advertiser_account_list ?? [];
  const row = rows.find(
    (item) => String(item.advertiser_id ?? item.advertiserId ?? "") === want,
  );
  if (!row) {
    return { balanceUsd: null, limit: emptyLimit() };
  }
  return {
    balanceUsd: pickSpendableBudgetUsd(row),
    limit: pickBudgetLimitSnapshot(row),
  };
}

async function fetchOneAdvertiserBalance(input: {
  bcId: string;
  advertiserId: string;
  accessToken: string;
}): Promise<AdvertiserBalanceRow> {
  try {
    const first = await fetchOneAdvertiserBalanceOnce(input);
    if (first.balanceUsd != null) return first;
    // Keyword miss / página vacía: un reintento corto suele recuperar la fila.
    await sleep(250);
    return await fetchOneAdvertiserBalanceOnce(input);
  } catch (error) {
    await sleep(350);
    try {
      return await fetchOneAdvertiserBalanceOnce(input);
    } catch {
      throw error;
    }
  }
}

async function fetchAdvertiserBalancesForBc(input: {
  bcId: string;
  advertiserIds: string[];
}): Promise<Map<string, AdvertiserBalanceRow>> {
  const result = new Map<string, AdvertiserBalanceRow>();
  const ids = [...new Set(input.advertiserIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return result;

  const { token } = await resolveTikTokFinanceAccessToken();
  const settled = await Promise.allSettled(
    ids.map((advertiserId) =>
      fetchOneAdvertiserBalance({
        bcId: input.bcId,
        advertiserId,
        accessToken: token,
      }).then((row) => ({ advertiserId, row })),
    ),
  );

  let firstError: Error | null = null;
  for (const item of settled) {
    if (item.status === "rejected") {
      if (!firstError) {
        firstError =
          item.reason instanceof Error
            ? item.reason
            : new Error("No se pudo leer saldo TikTok.");
      }
      continue;
    }
    result.set(item.value.advertiserId, item.value.row);
  }

  // Si ninguna cuenta resolvió y hubo error de API, propagar (UI: “sin datos”).
  if (result.size === 0 && firstError) throw firstError;

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

function toLiveMetrics(
  advertiserId: string,
  fetchedAt: string,
  balance: AdvertiserBalanceRow | undefined,
  spendTodayUsd: number | null,
  error?: string,
): AdvertiserLiveMetrics {
  const limit = balance?.limit ?? emptyLimit();
  return {
    advertiserId,
    balanceUsd: balance?.balanceUsd ?? null,
    spendTodayUsd,
    fetchedAt,
    error,
    paymentPortfolioType: limit.paymentPortfolioType,
    budgetMode: limit.budgetMode,
    budgetUsd: limit.budgetUsd,
    budgetCostUsd: limit.budgetCostUsd,
    showBudgetLimit: limit.showBudgetLimit,
    isUnlimitedBudget: limit.isUnlimited,
  };
}

export async function fetchAdvertiserLiveMetrics(input: {
  bcId: string;
  advertiserIds: string[];
}): Promise<AdvertiserLiveMetrics[]> {
  const ids = [...new Set(input.advertiserIds.map((id) => id.trim()).filter(Boolean))];
  const fetchedAt = new Date().toISOString();
  const today = todayLimaYmd();

  if (ids.length === 0) return [];

  const [balanceOutcome, spendResults] = await Promise.all([
    fetchAdvertiserBalancesForBc({
      bcId: input.bcId,
      advertiserIds: ids,
    }).then(
      (map) => ({ ok: true as const, map }),
      (error: unknown) => ({
        ok: false as const,
        error:
          error instanceof Error ? error.message : "Error de saldo",
      }),
    ),
    Promise.all(
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
    ),
  ]);

  const spendById = new Map(
    spendResults.map((row) => [row.advertiserId, row.spend]),
  );

  if (!balanceOutcome.ok) {
    return ids.map((advertiserId) =>
      toLiveMetrics(
        advertiserId,
        fetchedAt,
        undefined,
        spendById.get(advertiserId) ?? null,
        balanceOutcome.error,
      ),
    );
  }

  return ids.map((advertiserId) =>
    toLiveMetrics(
      advertiserId,
      fetchedAt,
      balanceOutcome.map.get(advertiserId),
      spendById.get(advertiserId) ?? null,
    ),
  );
}
