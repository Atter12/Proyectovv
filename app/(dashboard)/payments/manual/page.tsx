import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ManualVoucherReviewHost } from "@/features/payments/components/ManualVoucherReviewHost";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

export default async function ManualPaymentsReviewPage() {
  const session = await requirePermission("payments:read");
  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  if (!capabilities.isStaff && !capabilities.isSuperAdmin) {
    redirect(routes.payments);
  }

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected?.id) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty
          section="Pagos manuales"
          mode="staff"
        />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--auth-muted)]">
          Gerente · Finanzas · {selected.name}
        </p>
        <h1 className="text-xl font-bold tracking-tight text-[var(--auth-text)] sm:text-2xl">
          Pagos manuales
        </h1>
        <p className="max-w-2xl text-sm text-[var(--auth-muted)]">
          Solo boletas de{" "}
          <strong className="font-semibold text-[var(--auth-text)]">
            Pago manual
          </strong>{" "}
          de{" "}
          <strong className="font-semibold text-[var(--auth-text)]">
            {selected.name}
          </strong>
          . No mezclamos otros clientes ni recargas BM. Aceptá para acreditar
          cartera o rechazá con motivo. El resto sigue en{" "}
          <a
            href={routes.payments}
            className="font-semibold text-[var(--brand-primary)] underline-offset-2 hover:underline"
          >
            Pagos
          </a>
          .
        </p>
      </header>

      <ManualVoucherReviewHost
        staffMode
        hecomClienteId={selected.id}
        clienteName={selected.name}
      />
    </div>
  );
}
