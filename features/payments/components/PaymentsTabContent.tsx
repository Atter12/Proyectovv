import { PaymentToolbar } from "./PaymentToolbar.client";
import { PaymentsHistoryEmpty } from "./PaymentsHistoryEmpty";
import { PaymentsTable } from "./PaymentsTable";
import type {
  PaymentAccountAllocation,
  PaymentOverview,
  PaymentTabKey,
} from "@/types/payment";

interface PaymentsTabContentProps {
  data: PaymentOverview;
  tab: PaymentTabKey;
  filteredAccounts: PaymentAccountAllocation[];
  search: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

export function PaymentsTabContent({
  data,
  tab,
  filteredAccounts,
  search,
  status,
  onSearchChange,
  onStatusChange,
}: PaymentsTabContentProps) {
  switch (tab) {
    case "assignment":
      return (
        <>
          <PaymentToolbar
            search={search}
            status={status}
            onSearchChange={onSearchChange}
            onStatusChange={onStatusChange}
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
