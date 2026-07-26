import { PaymentsAssignmentPanel } from "./PaymentsAssignmentPanel.client";
import type { PaymentAccountAllocation } from "@/types/payment";

interface PaymentsAllocateSectionProps {
  accounts: PaymentAccountAllocation[];
  walletBalanceLabel: string;
  clienteName?: string;
}

/** Paso 2 del flujo: mover saldo de cartera → cuenta ads. */
export function PaymentsAllocateSection({
  accounts,
  walletBalanceLabel,
  clienteName,
}: PaymentsAllocateSectionProps) {
  return (
    <section
      id="asignar-saldo"
      className="overflow-hidden rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]"
    >
      <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a5a38]">
          Paso 2
          {clienteName ? ` · ${clienteName}` : ""}
        </p>
        <h2 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-[#1a1612]">
          Asignar saldo a cuentas ads
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
          Tenés {walletBalanceLabel} en cartera. Solo cuentas de
          {clienteName ? ` ${clienteName}` : " este cliente"}. Mové plata para
          que puedan gastar en TikTok.
        </p>
      </div>

      <PaymentsAssignmentPanel accounts={accounts} />
    </section>
  );
}
