"use client";

import { usePaymentsFundingMode } from "./PaymentsFundingModeContext.client";

export function PaymentsAllocateSectionCopy({
  walletBalanceLabel,
  walletBalance,
  clienteName,
}: {
  walletBalanceLabel: string;
  walletBalance: number;
  clienteName?: string;
}) {
  const { agencyBmFunding } = usePaymentsFundingMode();
  const who = clienteName ? ` ${clienteName}` : " este cliente";
  const hasWallet = walletBalance > 0;

  if (agencyBmFunding) {
    return (
      <>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a5a38]">
          2 · Gerente · Fondear desde BM
          {clienteName ? ` · ${clienteName}` : ""}
        </p>
        <h2 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-[#1a1612]">
          Mover cash del BM a cuentas TikTok
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
          No hace falta que el cliente tenga saldo en cartera Holistic. Asigná
          y se mueve cash del Business Center a la cuenta ads de
          {who}.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a5a38]">
        2 · Cliente · Asignar desde cartera
        {clienteName ? ` · ${clienteName}` : ""}
      </p>
      <h2 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-[#1a1612]">
        Asignar saldo a cuentas TikTok
      </h2>
      <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
        {hasWallet ? (
          <>
            Tenés {walletBalanceLabel} en cartera Holistic. Listo para asignar a
            una cuenta TikTok de
            {who}.
          </>
        ) : (
          <>
            Cartera Holistic en {walletBalanceLabel}. Primero recargá arriba
            (Stripe / manual). Solo cuentas de
            {who}.
          </>
        )}
      </p>
    </>
  );
}
