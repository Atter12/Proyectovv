import { PaymentsAssignmentPanel } from "./PaymentsAssignmentPanel.client";
import type { PaymentAccountAllocation } from "@/types/payment";

interface PaymentsAllocateSectionProps {
  accounts: PaymentAccountAllocation[];
  walletBalanceLabel: string;
  /** Saldo disponible en cartera Holistic (misma moneda que el label). */
  walletBalance: number;
  clienteName?: string;
}

/** Paso 2: fondear cuenta ads desde cartera Holistic (+ cash del BM vía API). */
export function PaymentsAllocateSection({
  accounts,
  walletBalanceLabel,
  walletBalance,
  clienteName,
}: PaymentsAllocateSectionProps) {
  const hasWallet = walletBalance > 0;
  const who = clienteName ? ` ${clienteName}` : " este cliente";

  return (
    <section
      id="asignar-saldo"
      className="overflow-hidden rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]"
    >
      <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a5a38]">
          2 · Fondear cuenta ads
          {clienteName ? ` · ${clienteName}` : ""}
        </p>
        <h2 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-[#1a1612]">
          Asignar saldo a cuentas TikTok
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
          {hasWallet ? (
            <>
              Tenés {walletBalanceLabel} en cartera Holistic. Listo para asignar
              a una cuenta TikTok de
              {who}. Asignar descuenta Holistic y mueve cash del BM a esa cuenta
              ads.
            </>
          ) : (
            <>
              Cartera Holistic en {walletBalanceLabel}. Primero recargá arriba
              (Stripe / manual). Asignar usa cartera Holistic + cash del BM —
              no alcanza con el saldo que ya se vea en TikTok Ads Manager.
              Solo cuentas de
              {who}.
            </>
          )}
        </p>
      </div>

      <PaymentsAssignmentPanel accounts={accounts} />
    </section>
  );
}
