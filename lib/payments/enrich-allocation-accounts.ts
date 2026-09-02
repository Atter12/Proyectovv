import type { AdAccount } from "@/types/ad-account";
import type { PaymentAccountAllocation } from "@/types/payment";
import { formatBmBucketLabel } from "@/lib/hecom/bm-label";
import { isStaffBlockedAdAccount } from "@/lib/payments/staff-block.server";

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

    const blocked = isStaffBlockedAdAccount({
      status: account.status,
      externalAccountId: externalId,
    });
    return {
      ...account,
      name: displayName,
      externalAccountName: meta.externalAccountName ?? displayName,
      bmLabel,
      // Priorizar estado live de Cuentas ads (suspendida gana).
      status:
        blocked || meta.status === "disabled" ? "disabled" : account.status,
      // Si Pagos tiene $0 pero ads overview trae balance, no inventamos;
      // el balance de Pagos viene del ledger (fuente de verdad para Recuperar).
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
): Array<{ advertiserId: string; name?: string | null; status?: string | null }> {
  const metaById = new Map(
    adsAccounts
      .map((row) => {
        const id = row.externalAccountId?.trim();
        if (!id) return null;
        return [
          id,
          {
            name:
              row.externalAccountName?.trim() ||
              row.name?.trim() ||
              `TikTok ${id}`,
            status: row.status,
          },
        ] as const;
      })
      .filter(
        (
          entry,
        ): entry is readonly [
          string,
          { name: string; status: AdAccount["status"] },
        ] => Boolean(entry),
      ),
  );

  return advertiserIds.map((advertiserId) => {
    const meta = metaById.get(advertiserId);
    return {
      advertiserId,
      name: meta?.name ?? null,
      status: meta?.status ?? null,
    };
  });
}
