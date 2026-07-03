import { PaymentToolbar } from "./PaymentToolbar.client";
import { PaymentsHistoryEmpty } from "./PaymentsHistoryEmpty";
import { PaymentsTable } from "./PaymentsTable";
import type { PaymentAccountAllocation, PaymentOverview, PaymentTabKey } from "@/types/payment";

interface PaymentsTabContentProps {
  data: PaymentOverview;
  tab: PaymentTabKey;
  filteredAccounts: PaymentAccountAllocation[];
  initialSearch?: string;
  initialStatus?: string;
}

export function PaymentsTabContent({
  data,
  tab,
  filteredAccounts,
  initialSearch = "",
  initialStatus = "all",
}: PaymentsTabContentProps) {
  switch (tab) {
    case "assignment":
      return (
        <>
          <PaymentToolbar
            initialSearch={initialSearch}
            initialStatus={initialStatus}
          />
          <PaymentsTable accounts={filteredAccounts} />
        </>
      );
    case "account-tx":
      return data.accountTransactions.length > 0 ? null : <PaymentsHistoryEmpty />;
    case "wallet-tx":
      return data.walletTransactions.length > 0 ? null : <PaymentsHistoryEmpty />;
    case "refunds":
      return data.refunds.length > 0 ? null : <PaymentsHistoryEmpty />;
  }
}
