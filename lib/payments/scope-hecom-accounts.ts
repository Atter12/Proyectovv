import type { PaymentAccountAllocation } from "@/types/payment";

/** Keep only Holistic ad accounts whose TikTok advertiser id belongs to the Hecom cliente. */
export function scopeAllocationAccountsToHecomAdvertisers(
  accounts: PaymentAccountAllocation[],
  advertiserIds: string[],
): PaymentAccountAllocation[] {
  const allowed = new Set(
    advertiserIds.map((id) => id.trim()).filter(Boolean),
  );
  if (allowed.size === 0) return [];

  return accounts.filter((account) => {
    const external = account.externalAccountId?.trim();
    return Boolean(external && allowed.has(external));
  });
}
