import { ClientAffiliateDashboard } from "@/features/affiliates/components/ClientAffiliateDashboard.client";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { getClientAffiliateProgram } from "@/lib/affiliates/client-program.server";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { requirePermission } from "@/lib/auth/guards.server";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export default async function AffiliatesPage() {
  const session = await requirePermission("affiliates:read");
  const funding = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const mode =
    funding.isStaff || funding.isSuperAdmin ? "staff" : "cliente";
  const selected = await getSelectedHecomCliente(session.id);

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="el programa de afiliados" mode={mode} />
      </div>
    );
  }

  const data = await getHecomClienteDashboard(selected.id);
  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="el programa de afiliados" mode={mode} />
      </div>
    );
  }

  const program = await getClientAffiliateProgram(session);

  return (
    <div className={dashboardClasses.page}>
      <ClientAffiliateDashboard program={program} />
    </div>
  );
}
