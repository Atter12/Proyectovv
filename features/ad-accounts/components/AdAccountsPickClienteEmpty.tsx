import Link from "next/link";
import { routes } from "@/config/routes";

export function AdAccountsPickClienteEmpty() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]/15">
        <span className="text-2xl font-bold">CL</span>
      </div>
      <h3 className="font-display text-[1.1rem] font-medium text-[var(--foreground)]">
        Primero elegí un cliente
      </h3>
      <p className="mt-2 max-w-md text-[14px] leading-6 text-[var(--admin-text-muted,#64748b)]">
        En <strong>Clientes</strong> elegí a Adriana (u otro). Después acá solo
        van a aparecer las cuentas publicitarias de esa persona.
      </p>
      <Link
        href={routes.clientes}
        className="mt-5 inline-flex h-10 items-center rounded-xl bg-[var(--brand-primary)] px-5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-deep)]"
      >
        Ir a Clientes
      </Link>
    </div>
  );
}
