import Link from "next/link";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ManualVoucherReviewHost } from "@/features/payments/components/ManualVoucherReviewHost";
import { requirePermission } from "@/lib/auth/guards.server";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import { getActingAsCliente, getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

export default async function ManualPaymentsReviewPage({
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
          Gerente · Finanzas
          {hecomClienteId ? " · Filtro cliente" : " · Todos los clientes"}
        </p>
        <h1 className="text-xl font-bold tracking-tight text-[var(--auth-text)] sm:text-2xl">
          Pagos manuales
        </h1>
        <p className="max-w-3xl text-sm text-[var(--auth-muted)]">
          Cola global de boletas{" "}
          <strong className="font-semibold text-[var(--auth-text)]">
            Pago manual (BCP)
          </strong>
          : ves <strong className="font-semibold text-[var(--auth-text)]">todos</strong> los
          clientes en orden (pendientes más viejos primero). Aceptá para acreditar
          cartera o rechazá con motivo. Recargas BM no aparecen acá — eso va en{" "}
          <Link
            href={routes.payments}
            className="font-semibold text-[var(--brand-primary)] underline-offset-2 hover:underline"
          >
            Pagos
          </Link>
          .
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {hecomClienteId ? (
            <>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200/80">
                Filtrado
                {clienteName ? `: ${clienteName}` : ""}
              </span>
              <Link
                href={routes.paymentsManual}
                className="text-xs font-semibold text-[var(--brand-primary)] underline-offset-2 hover:underline"
              >
                Ver todos los clientes
              </Link>
            </>
          ) : selected?.id ? (
            <Link
              href={`${routes.paymentsManual}?cliente=${encodeURIComponent(selected.id)}`}
              className="text-xs font-medium text-[var(--auth-muted)] underline-offset-2 hover:text-[var(--auth-text)] hover:underline"
            >
              Filtrar solo {selected.name}
            </Link>
          ) : null}
        </div>
      </header>

      <ManualVoucherReviewHost
        staffMode
        hecomClienteId={hecomClienteId}
        clienteName={clienteName ?? selected?.name}
      />
    </div>
  );
}
