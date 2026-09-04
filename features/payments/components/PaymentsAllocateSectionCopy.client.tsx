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
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
          Gerente · Recargar desde BM
          {clienteName ? ` · ${clienteName}` : ""}
        </p>
        <h2 className="mt-1.5 text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
          Recargar cuentas TikTok desde el BM
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
          Fondeás la cuenta ads de{who} desde el Business Center (BM 200 = cash;
          BM 10/30 = presupuesto de crédito). No exige cartera Holistic
          {hasWallet
            ? ` (ahora hay ${walletBalanceLabel} disponible para asignar si querés).`
            : ` (cartera Holistic: ${walletBalanceLabel}).`}{" "}
          <span className="font-semibold text-[var(--auth-text)]">
            No baja la deuda neta Hecom
          </span>{" "}
          (eso baja solo con cobro del cliente). Usá cuentas Aprobadas. Si una se
          suspende con saldo, queda acá con{" "}
          <span className="font-semibold text-[var(--auth-text)]">Recuperar</span>
          ; al jalárselo a cartera sale de esta lista (sigue en Cuentas ads).
        </p>
      </>
    );
  }

  return (
    <>
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
        Cliente · Asignar desde cartera
        {clienteName ? ` · ${clienteName}` : ""}
      </p>
      <h2 className="mt-1.5 text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
        Asignar saldo a cuentas TikTok
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
        {hasWallet ? (
          <>
            Cartera Holistic: {walletBalanceLabel} (para asignar). El número
            grande en cada fila es el{" "}
            <span className="font-semibold text-[var(--auth-text)]">
              disponible TikTok
            </span>{" "}
            (Manager). Si ves presupuesto/gastado/queda, no es gasto de más: es
            el tope de la cuenta. Para pasar plata entre cuentas usá{" "}
            <span className="font-semibold text-[var(--auth-text)]">
              Transferir a otra cuenta
            </span>
            .
          </>
        ) : (
          <>
            Cartera Holistic en {walletBalanceLabel}. Primero recargá arriba
            (Stripe / manual) si querés asignar. Abajo ves el{" "}
            <span className="font-semibold text-[var(--auth-text)]">
              disponible TikTok
            </span>{" "}
            y el presupuesto (tope · gastado · queda).
          </>
        )}
      </p>
    </>
  );
}
