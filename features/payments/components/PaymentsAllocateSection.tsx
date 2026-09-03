"use client";

import { PaymentsAssignmentPanel } from "./PaymentsAssignmentPanel.client";
import type { PaymentAccountAllocation } from "@/types/payment";
import { PaymentsAllocateSectionCopy } from "./PaymentsAllocateSectionCopy.client";
import { usePaymentsFundingMode } from "./PaymentsFundingModeContext.client";

interface PaymentsAllocateSectionProps {
  accounts: PaymentAccountAllocation[];
  walletBalanceLabel: string;
  walletBalance: number;
  clienteName?: string;
  allowForceLedger?: boolean;
}

/** Paso 2: fondear cuenta ads (copy depende del modo Cliente/Gerente). */
export function PaymentsAllocateSection({
  accounts,
  walletBalanceLabel,
  walletBalance,
  clienteName,
  allowForceLedger = false,
}: PaymentsAllocateSectionProps) {
  const { agencyBmFunding } = usePaymentsFundingMode();

  return (
    <section
      id="asignar-saldo"
      className="dashboard-surface-card overflow-hidden rounded-[1rem]"
    >
      <div className="border-b border-[var(--auth-border)] px-5 py-4 sm:px-6">
        <PaymentsAllocateSectionCopy
          walletBalanceLabel={walletBalanceLabel}
          walletBalance={walletBalance}
          clienteName={clienteName}
        />
      </div>

      <PaymentsAssignmentPanel
        accounts={accounts}
        agencyBmFunding={agencyBmFunding}
        allowForceLedger={allowForceLedger}
        walletBalance={walletBalance}
      />
    </section>
  );
}
