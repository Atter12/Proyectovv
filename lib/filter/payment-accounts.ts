import type { PaymentAccountAllocation } from "@/types/payment";

export interface PaymentAccountFilterParams {
  search?: string;
  status?: string;
}

export function filterPaymentAccounts(
  accounts: PaymentAccountAllocation[],
  { search = "", status = "all" }: PaymentAccountFilterParams,
): PaymentAccountAllocation[] {
  const q = search.toLowerCase();

  return accounts.filter((account) => {
    const matchesSearch =
      search === "" ||
      account.name.toLowerCase().includes(q) ||
      account.id.toLowerCase().includes(q);
    const matchesStatus =
      status === "all" || account.status.toLowerCase() === status;
    return matchesSearch && matchesStatus;
  });
}
