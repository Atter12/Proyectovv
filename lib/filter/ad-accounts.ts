import type { AdAccount, AdAccountStatus } from "@/types/ad-account";

const statusLabels: Record<AdAccountStatus, string> = {
  active: "activa",
  pending: "pendiente",
  disabled: "desactivada",
  review: "revisión",
  archived: "archivada",
};

export interface AdAccountFilterParams {
  search?: string;
  status?: string;
}

export function filterAdAccounts(
  accounts: AdAccount[],
  { search = "", status = "all" }: AdAccountFilterParams,
): AdAccount[] {
  const searchLower = search.toLowerCase();

  return accounts.filter((account) => {
    const statusLabel = statusLabels[account.status];
    const matchesSearch =
      search === "" ||
      account.id.toLowerCase().includes(searchLower) ||
      account.bcId.toLowerCase().includes(searchLower) ||
      account.name.toLowerCase().includes(searchLower) ||
      account.platform.toLowerCase().includes(searchLower) ||
      (account.externalAccountId ?? "").toLowerCase().includes(searchLower) ||
      (account.externalBusinessId ?? "").toLowerCase().includes(searchLower) ||
      (account.externalAccountName ?? "").toLowerCase().includes(searchLower) ||
      account.connectionLabel.toLowerCase().includes(searchLower) ||
      statusLabel.includes(searchLower);
    const matchesStatus = status === "all" || account.status === status;
    return matchesSearch && matchesStatus;
  });
}
