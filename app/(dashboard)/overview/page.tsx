import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedOverview } from "@/features/clientes/components/ClienteScopedOverview";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { isOtpTestClienteId } from "@/lib/hecom/clientes.server";
import { requireSession } from "@/lib/auth/guards.server";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await requireSession();
  const rawFunding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const actingAsCliente = await getActingAsCliente(session.id);
  const funding = withActAsClienteView(rawFunding, actingAsCliente);
  const canChangeCliente =
    funding.isStaff || funding.isSuperAdmin || actingAsCliente;

  let selected = await getSelectedHecomCliente(session.id);
  if (
    selected &&
    rawFunding.isStaff &&
    isOtpTestClienteId(selected.id) &&
    !rawFunding.isSuperAdmin
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
    data = await getHecomClienteDashboard(selected.id, {
      includeCampaignSpend: false,
    });
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
