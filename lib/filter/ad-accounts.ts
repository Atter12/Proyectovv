import type { AdAccount, AdAccountStatus } from "@/types/ad-account";

const statusLabels: Record<AdAccountStatus, string> = {
  active: "activa",
  pending: "pendiente",
  disabled: "desactivada",
  review: "revisión",
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
      statusLabel.includes(searchLower);
    const matchesStatus = status === "all" || account.status === status;
    return matchesSearch && matchesStatus;
  });
}
