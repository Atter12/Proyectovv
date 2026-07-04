import { PaymentsAssignmentPanel } from "./PaymentsAssignmentPanel.client";
import { PaymentsHistoryEmpty } from "./PaymentsHistoryEmpty";
import { PaymentsTransactionsList } from "./PaymentsTransactionsList";
import {
  getPaymentPageCore,
  getPaymentTransactions,
} from "@/services/payments.service";
import { isTransactionTab } from "@/lib/payments/tab-params";
import type { SessionUser } from "@/types/auth";
import type { PaymentTabKey } from "@/types/payment";

interface PaymentsTabPanelProps {
  session: SessionUser;
  tab: PaymentTabKey;
}

export async function PaymentsTabPanel({ session, tab }: PaymentsTabPanelProps) {
  if (tab === "assignment") {
    const core = await getPaymentPageCore(session);
    return <PaymentsAssignmentPanel accounts={core.adAccountsForAllocation} />;
  }

  if (!isTransactionTab(tab)) {
    return null;
  }

  const transactions = await getPaymentTransactions(session, tab);

  if (transactions.length === 0) {
    return <PaymentsHistoryEmpty />;
  }

  return <PaymentsTransactionsList transactions={transactions} />;
}
