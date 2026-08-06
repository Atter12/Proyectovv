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
}

/** Paso 2: fondear cuenta ads (copy depende del modo Cliente/Gerente). */
export function PaymentsAllocateSection({
  accounts,
  walletBalanceLabel,
  walletBalance,
  clienteName,
}: PaymentsAllocateSectionProps) {
  const { agencyBmFunding } = usePaymentsFundingMode();

  return (
    <section
      id="asignar-saldo"
      className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]"
    >
      <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <PaymentsAllocateSectionCopy
          walletBalanceLabel={walletBalanceLabel}
          walletBalance={walletBalance}
          clienteName={clienteName}
        />
      </div>

      <PaymentsAssignmentPanel
        accounts={accounts}
        agencyBmFunding={agencyBmFunding}
      />
    </section>
  );
}
