import Link from "next/link";
import { routes } from "@/config/routes";
import { PaymentsOpenAddBalanceButton } from "./PaymentsOpenAddBalanceButton.client";

export function PaymentsEmptyState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]/15">
        <svg
          className="h-7 w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
          />
        </svg>
      </div>
      <h3 className="font-display text-[1.1rem] font-medium text-[var(--foreground)]">
        No hay datos disponibles
      </h3>
      <p className="mt-2 max-w-md text-[14px] leading-6 text-[var(--admin-text-muted,#64748b)]">
        Todavía no tienes cuentas publicitarias con saldo asignado. Crea una
        cuenta o agrega fondos a tu cartera para comenzar.
      </p>
      <PaymentsOpenAddBalanceButton className="mt-5 inline-flex h-10 items-center rounded-xl bg-[var(--brand-primary)] px-5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-deep)]">
        Agregar saldo
      </PaymentsOpenAddBalanceButton>
      <Link
        href={routes.adAccounts}
        className="mt-3 text-[14px] font-medium text-[var(--brand-primary)] transition-colors hover:text-[var(--brand-primary-deep)]"
      >
        Crear cuenta publicitaria
      </Link>
    </div>
  );
}
