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

function resolveBcIdForBucket(bmBucket: string | null | undefined): string | null {
  const bucket = String(bmBucket ?? "").trim();
  if (!bucket) return null;
  return HECOM_BM_BUCKET_TO_BC[bucket] ?? null;
}

export async function getHecomAdAccountsLiveMetrics(
  clienteId: string,
  speed: HecomAdAccountsLoadSpeed = "fast",
): Promise<{
  accounts: AdAccountLiveMetricsRow[];
  updatedAt: string;
  tiktokConfigured: boolean;
}> {
  const overview = await getHecomClienteAdAccountsOverview(clienteId, speed);
  const updatedAt = new Date().toISOString();

  if (!overview.cliente || overview.accounts.length === 0) {
    return { accounts: [], updatedAt, tiktokConfigured: true };
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

  const rows: AdAccountLiveMetricsRow[] = [];

  for (const [bcId, items] of byBc.entries()) {
    const metrics = await fetchAdvertiserLiveMetrics({
      bcId,
      advertiserIds: items.map((item) => item.advertiserId),
    });
    const metaById = new Map(items.map((item) => [item.advertiserId, item]));
    for (const metric of metrics) {
      const meta = metaById.get(metric.advertiserId);
      rows.push({
        ...metric,
        accountName: meta?.name ?? metric.advertiserId,
        bmBucket: meta?.bmBucket ?? null,
      });
    }
  }

  return {
    accounts: rows,
    updatedAt,
    tiktokConfigured: byBc.size > 0,
  };
}
