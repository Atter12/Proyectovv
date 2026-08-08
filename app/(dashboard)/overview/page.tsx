import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedOverview } from "@/features/clientes/components/ClienteScopedOverview";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { isOtpTestClienteId } from "@/lib/hecom/clientes.server";
import { requireSession } from "@/lib/auth/guards.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export default async function OverviewPage() {
  const session = await requireSession();
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const canChangeCliente =
    funding.isStaff || funding.isSuperAdmin || funding.canAgencyBmFund;

  let selected = await getSelectedHecomCliente(session.id);
  if (
    selected &&
    funding.isStaff &&
    isOtpTestClienteId(selected.id) &&
    !funding.isSuperAdmin
  ) {
    selected = null;
  }

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty
          section="la descripción general"
          mode={canChangeCliente ? "staff" : "cliente"}
        />
      </div>
    );
  }

  let data: Awaited<ReturnType<typeof getHecomClienteDashboard>> = null;
  try {
    data = await getHecomClienteDashboard(selected.id);
  } catch (error) {
    console.error("[overview] dashboard failed", {
      clienteId: selected.id,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty
          section="la descripción general"
          mode={canChangeCliente ? "staff" : "cliente"}
        />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <ClienteScopedOverview
        data={data}
        canChangeCliente={canChangeCliente}
      />
    </div>
  );
}
