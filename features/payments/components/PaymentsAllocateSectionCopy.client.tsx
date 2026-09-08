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

  if (agencyBmFunding) {
    return (
      <>
        <h2 className="text-[1.2rem] font-semibold tracking-[-0.025em] text-[var(--auth-text)]">
          Recargar una cuenta de TikTok
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
          Elige una cuenta{clienteName ? ` de ${clienteName}` : ""} y usa el
          saldo disponible del Business Center. Si una cuenta suspendida todavía
          tiene saldo, puedes recuperarlo desde su acción.
        </p>
      </>
    );
  }

  return (
    <>
      <h2 className="text-[1.2rem] font-semibold tracking-[-0.025em] text-[var(--auth-text)]">
        Asignar saldo a TikTok
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
        {walletBalance > 0 ? (
          <>Elige la cuenta que quieres recargar y define cuánto saldo asignar.</>
        ) : (
          <>
            Tu cartera está en {walletBalanceLabel}.{" "}
            <a
              href="#recargar-saldo"
              className="font-semibold text-[var(--auth-accent)] underline-offset-2 hover:underline"
            >
              Recarga saldo primero
            </a>
            .
          </>
        )}
      </p>
    </>
  );
}
