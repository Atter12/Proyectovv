import Link from "next/link";
import { routes } from "@/config/routes";

export function AdAccountsInfoAlert() {
  return (
    <div className="flex gap-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-primary)]/[0.04] p-4 sm:p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[var(--foreground)]">
          Información importante
        </p>
        <p className="mt-1 text-[14px] leading-6 text-[var(--admin-text-muted,#64748b)]">
          Las cuentas publicitarias requieren saldo asignado desde la cartera
          para activar campañas.
        </p>
        <Link
          href={routes.overview}
          className="mt-2 inline-flex text-[14px] font-medium text-[var(--brand-primary)] transition-colors hover:text-[var(--brand-primary-deep)]"
        >
          Ver guía de configuración
        </Link>
      </div>
    </div>
  );
}
