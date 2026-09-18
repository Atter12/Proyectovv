import Link from "next/link";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { MissingCobroVoucherReviewHost } from "@/features/payments/components/MissingCobroVoucherReviewHost";
import { requirePermission } from "@/lib/auth/guards.server";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

export default async function MissingCobrosReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("payments:read");
  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  if (!capabilities.isStaff && !capabilities.isSuperAdmin) {
    redirect(routes.payments);
  }

  if (await getActingAsCliente(session.id)) {
    redirect(routes.payments);
  }

  const params = await searchParams;
  const filterCliente =
    typeof params.cliente === "string" && params.cliente.trim()
      ? params.cliente.trim()
      : null;

  const selected = await getSelectedHecomCliente(session.id);
  const hecomClienteId = filterCliente;
  let clienteName: string | undefined;
  if (filterCliente) {
    if (selected?.id === filterCliente) {
      clienteName = selected.name;
    } else {
      const c = await getHecomCliente(filterCliente).catch(() => null);
      clienteName = c?.name;
    }
  }

  return (
    <div className={dashboardClasses.page}>
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--auth-muted)]">
          Gerente · Lo pagado
          {hecomClienteId ? " · Filtro cliente" : " · Todos los clientes"}
        </p>
        <h1 className="text-xl font-bold tracking-tight text-[var(--auth-text)] sm:text-2xl">
          Cobros faltantes
        </h1>
        <p className="max-w-3xl text-sm text-[var(--auth-muted)]">
          El cliente reportó un pago que no está en Hecom. Al{" "}
          <strong className="font-semibold text-[var(--auth-text)]">
            aceptar
          </strong>{" "}
          se crea el cobro en ese mes —{" "}
          <strong className="font-semibold text-[var(--auth-text)]">
            no acredita cartera
          </strong>
          .
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {hecomClienteId ? (
            <>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900 ring-1 ring-sky-200/80">
                Filtrado
                {clienteName ? `: ${clienteName}` : ""}
              </span>
              <Link
                href={routes.paymentsMissingCobros}
                className="text-xs font-semibold text-[var(--brand-primary)] underline-offset-2 hover:underline"
              >
                Ver todos los clientes
              </Link>
            </>
          ) : selected?.id ? (
            <Link
              href={`${routes.paymentsMissingCobros}?cliente=${encodeURIComponent(selected.id)}`}
              className="text-xs font-medium text-[var(--auth-muted)] underline-offset-2 hover:text-[var(--auth-text)] hover:underline"
            >
              Filtrar solo {selected.name}
            </Link>
          ) : null}
          <Link
            href={routes.paymentsManual}
            className="text-xs font-medium text-[var(--auth-muted)] underline-offset-2 hover:text-[var(--auth-text)] hover:underline"
          >
            Ir a Pagos manuales (cartera)
          </Link>
        </div>
      </header>

      <MissingCobroVoucherReviewHost
        staffMode
        hecomClienteId={hecomClienteId}
        clienteName={clienteName ?? selected?.name}
      />
    </div>
  );
}
