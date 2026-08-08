import Link from "next/link";
import { routes } from "@/config/routes";

export function PickClienteEmpty({
  section = "esta sección",
  mode = "staff",
}: {
  section?: string;
  /** staff/gerente elige del CRM; cliente no ve el picker. */
  mode?: "staff" | "cliente";
}) {
  if (mode === "cliente") {
    return (
      <div className="dashboard-surface-card flex min-h-[240px] flex-col items-center justify-center rounded-[1rem] px-6 py-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--auth-accent-soft)] text-[var(--auth-accent)]">
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.6}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
            />
          </svg>
        </div>
        <h3 className="text-[1.25rem] font-bold leading-tight tracking-[-0.03em] text-[var(--auth-text)]">
          Tu panel de cliente
        </h3>
        <p className="mt-2 max-w-md text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
          Desde acá recargás con Stripe y asignás a tus cuentas ads. No
          necesitás elegir entre clientes del CRM.
        </p>
        <Link
          href={routes.payments}
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-[var(--auth-accent)] px-5 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
        >
          Ir a pagos
        </Link>
      </div>
    );
  }

  return (
    <div className="dashboard-surface-card flex min-h-[240px] flex-col items-center justify-center rounded-[1rem] px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--auth-accent-soft)] text-[var(--auth-accent)]">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          />
        </svg>
      </div>
      <h3 className="text-[1.25rem] font-bold leading-tight tracking-[-0.03em] text-[var(--auth-text)]">
        Elegí un cliente para operar
      </h3>
      <p className="mt-2 max-w-md text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
        Para ver {section}, abrí la lista y elegí a quién fondear desde el BM.
        Después el panel queda filtrado a ese cliente.
      </p>
      <Link
        href={routes.clientes}
        className="mt-5 inline-flex h-10 items-center rounded-lg bg-[var(--auth-accent)] px-5 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
      >
        Ver todos los clientes
      </Link>
    </div>
  );
}
