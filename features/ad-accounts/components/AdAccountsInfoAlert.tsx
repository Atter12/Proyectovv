import Link from "next/link";
import { routes } from "@/config/routes";

export function AdAccountsInfoAlert() {
  return (
    <aside className="flex gap-3 rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-[#f6f0e8] px-4 py-3.5 sm:gap-4 sm:px-5">
      <div
        aria-hidden
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ebe3d8] text-[#6b5344]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[#2a241f]">
          Saldo y activación
        </p>
        <p className="mt-0.5 text-[13px] leading-5 text-[#6b645c]">
          Para que las campañas corran, la cuenta necesita saldo cargado desde
          la cartera. Sin fondos, la cuenta aparece mapeada pero no publica.
        </p>
        <Link
          href={routes.payments}
          className="mt-2 inline-flex text-[13px] font-medium text-[#c45a18] underline-offset-2 transition-colors hover:text-[#9a4512] hover:underline"
        >
          Ir a pagos y cartera
        </Link>
      </div>
    </aside>
  );
}
