import Link from "next/link";
import { routes } from "@/config/routes";

export function AdAccountsInfoAlert() {
  return (
    <div className="flex gap-4 rounded-2xl border border-[#4056ff]/15 bg-gradient-to-r from-[#4056ff]/5 to-[#7c3aed]/5 p-4 shadow-sm shadow-[#4056ff]/5 ring-1 ring-[#4056ff]/10 sm:p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4056ff]/10 text-[#4056ff]">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#0f172a]">Información importante</p>
        <p className="mt-1 text-sm leading-relaxed text-[#64748b]">
          Las cuentas publicitarias requieren saldo asignado desde Cartera Default
          para activar campañas.
        </p>
        <Link
          href={routes.overview}
          className="mt-2 inline-flex text-sm font-medium text-[#4056ff] transition-colors hover:text-[#7c3aed] hover:underline"
        >
          Ver guía de configuración
        </Link>
      </div>
    </div>
  );
}
