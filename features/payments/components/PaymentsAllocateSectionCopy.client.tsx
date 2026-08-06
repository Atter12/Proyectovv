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
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
          2 · Gerente · Fondear desde BM
          {clienteName ? ` · ${clienteName}` : ""}
        </p>
        <h2 className="font-display mt-1.5 text-[1.2rem] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
          Mover cash del BM a cuentas TikTok
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
          Movés cash del Business Center a la cuenta ads de
          {who}. Eso es presupuesto para pautar:{" "}
          <span className="font-semibold text-[var(--auth-text)]">
            no baja la deuda neta Hecom
          </span>{" "}
          (la deuda baja solo con un cobro del cliente).
        </p>
      </>
    );
  }

  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
        2 · Cliente · Asignar desde cartera
        {clienteName ? ` · ${clienteName}` : ""}
      </p>
      <h2 className="font-display mt-1.5 text-[1.2rem] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
        Asignar saldo a cuentas TikTok
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
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
