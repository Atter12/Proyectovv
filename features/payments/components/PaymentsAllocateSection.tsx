import { PaymentsAssignmentPanel } from "./PaymentsAssignmentPanel.client";
import type { PaymentAccountAllocation } from "@/types/payment";
import { PaymentsAllocateSectionCopy } from "./PaymentsAllocateSectionCopy.client";

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
  return (
    <section
      id="asignar-saldo"
      className="overflow-hidden rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]"
    >
      <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <PaymentsAllocateSectionCopy
          walletBalanceLabel={walletBalanceLabel}
          walletBalance={walletBalance}
          clienteName={clienteName}
        />
      </div>

      <PaymentsAssignmentPanel accounts={accounts} />
    </section>
  );
}
