import Link from "next/link";
import { routes } from "@/config/routes";
import { AdAccountsOpenCreateModalButton } from "./AdAccountsOpenCreateModalButton.client";

export function AdAccountsEmptyState() {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#f3eee8] text-[#6b5344] ring-1 ring-[rgb(20_18_16_/_0.08)]">
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
      <h3 className="text-[15px] font-medium tracking-[-0.01em] text-[#1a1612]">
        Aún no hay cuentas publicitarias
      </h3>
      <p className="mt-2 max-w-md text-[14px] leading-6 text-[#6b645c]">
        Creá la primera para asignar presupuesto, configurar campañas y empezar
        a publicar.
      </p>
      <AdAccountsOpenCreateModalButton className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#e85a1c] px-5 text-[13px] font-medium text-white transition-colors hover:bg-[#d14e16]">
        Crear cuenta publicitaria
      </AdAccountsOpenCreateModalButton>
      <Link
        href={routes.payments}
        className="mt-3 text-[13px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
      >
        Cargar saldo en cartera
      </Link>
    </div>
  );
}
