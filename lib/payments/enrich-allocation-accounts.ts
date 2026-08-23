import type { AdAccount } from "@/types/ad-account";
import type { PaymentAccountAllocation } from "@/types/payment";
import { formatBmBucketLabel } from "@/lib/hecom/bm-label";

/** Enriquece filas de Pagos con nombre TikTok y etiqueta BM desde Cuentas ads. */
export function enrichAllocationAccountsFromAdsOverview(
  accounts: PaymentAccountAllocation[],
  adsAccounts: AdAccount[],
): PaymentAccountAllocation[] {
  const byAdvertiserId = new Map(
    adsAccounts
      .map((row) => {
        const id = row.externalAccountId?.trim();
        if (!id) return null;
        return [id, row] as const;
      })
      .filter((entry): entry is readonly [string, AdAccount] => Boolean(entry)),
  );

  return accounts.map((account) => {
    const externalId = account.externalAccountId?.trim();
    const meta = externalId ? byAdvertiserId.get(externalId) : undefined;
    if (!meta) return account;

    const displayName =
      meta.externalAccountName?.trim() ||
      meta.name?.trim() ||
      account.name;
    const bmLabel =
      formatBmBucketLabel(meta.externalBusinessId, meta.bcId) ||
      account.bmLabel ||
      null;

    return {
      ...account,
      name: displayName,
      externalAccountName: meta.externalAccountName ?? displayName,
      bmLabel,
    };
  });
}

export function buildAdvertiserMetaFromAdsOverview(
  adsAccounts: AdAccount[],
): Array<{
  advertiserId: string;
  name: string;
  bmLabel: string | null;
}> {
  return adsAccounts
    .map((row) => {
      const advertiserId = row.externalAccountId?.trim();
      if (!advertiserId) return null;
      const name =
        row.externalAccountName?.trim() ||
        row.name?.trim() ||
        `TikTok ${advertiserId}`;
      return {
        advertiserId,
        name,
        bmLabel: formatBmBucketLabel(row.externalBusinessId, row.bcId),
      };
    })
    .filter(
      (
        row,
      ): row is {
        advertiserId: string;
        name: string;
        bmLabel: string | null;
      } => Boolean(row),
    );
}

export function buildAdvertiserEnsureList(
  advertiserIds: string[],
  adsAccounts: AdAccount[],
): Array<{ advertiserId: string; name?: string | null }> {
  const metaById = new Map(
    buildAdvertiserMetaFromAdsOverview(adsAccounts).map((row) => [
      row.advertiserId,
      row.name,
    ]),
  );

  return advertiserIds.map((advertiserId) => ({
    advertiserId,
    name: metaById.get(advertiserId) ?? null,
  }));
}
