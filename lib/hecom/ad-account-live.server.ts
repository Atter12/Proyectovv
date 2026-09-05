import "server-only";
import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";
import {
  getHecomClienteAdAccountsOverview,
  type HecomAdAccountsLoadSpeed,
} from "@/lib/hecom/ad-accounts.server";
import {
  fetchAdvertiserLiveMetrics,
  type AdvertiserLiveMetrics,
} from "@/lib/integrations/tiktok/advertiser-live.server";

export type AdAccountLiveMetricsRow = AdvertiserLiveMetrics & {
  accountName: string;
  bmBucket: string | null;
};

type LiveMetricsResult = {
  accounts: AdAccountLiveMetricsRow[];
  updatedAt: string;
  tiktokConfigured: boolean;
};

const LIVE_METRICS_TTL_MS = 20_000;
const liveMetricsCache = new Map<
  string,
  { at: number; value: LiveMetricsResult }
>();

function resolveBcIdForBucket(bmBucket: string | null | undefined): string | null {
  const bucket = String(bmBucket ?? "").trim();
  if (!bucket) return null;
  return HECOM_BM_BUCKET_TO_BC[bucket] ?? null;
}

export async function getHecomAdAccountsLiveMetrics(
  clienteId: string,
  speed: HecomAdAccountsLoadSpeed = "fast",
  opts?: { bypassCache?: boolean },
): Promise<LiveMetricsResult> {
  const cacheKey = `${clienteId}:${speed}`;
  if (!opts?.bypassCache) {
    const hit = liveMetricsCache.get(cacheKey);
    if (hit && Date.now() - hit.at < LIVE_METRICS_TTL_MS) {
      return hit.value;
    }
  }

  const overview = await getHecomClienteAdAccountsOverview(clienteId, speed);
  const updatedAt = new Date().toISOString();

  if (!overview.cliente || overview.accounts.length === 0) {
    const empty = { accounts: [], updatedAt, tiktokConfigured: true };
    liveMetricsCache.set(cacheKey, { at: Date.now(), value: empty });
    return empty;
  }

  const byBc = new Map<
    string,
    Array<{ advertiserId: string; name: string; bmBucket: string | null }>
  >();

  for (const account of overview.accounts) {
    const advertiserId = account.externalAccountId?.trim();
    if (!advertiserId || account.status === "disabled") continue;
    const bmBucket =
      account.externalBusinessId?.replace(/^BM\s*/i, "") ??
      account.bcId?.replace(/^BM\s*/i, "") ??
      null;
    const bcId = resolveBcIdForBucket(bmBucket);
    if (!bcId) continue;
    const list = byBc.get(bcId) ?? [];
    list.push({
      advertiserId,
      name: account.name,
      bmBucket,
    });
    byBc.set(bcId, list);
  }

  const bcBatches = await Promise.all(
    [...byBc.entries()].map(async ([bcId, items]) => {
      const metrics = await fetchAdvertiserLiveMetrics({
        bcId,
        advertiserIds: items.map((item) => item.advertiserId),
      });
      const metaById = new Map(items.map((item) => [item.advertiserId, item]));
      return metrics.map((metric) => {
        const meta = metaById.get(metric.advertiserId);
        return {
          ...metric,
          accountName: meta?.name ?? metric.advertiserId,
          bmBucket: meta?.bmBucket ?? null,
        } satisfies AdAccountLiveMetricsRow;
      });
    }),
  );

  const result: LiveMetricsResult = {
    accounts: bcBatches.flat(),
    updatedAt,
    tiktokConfigured: byBc.size > 0,
  };
  liveMetricsCache.set(cacheKey, { at: Date.now(), value: result });
  return result;
}
