import { Suspense } from "react";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedGastos } from "@/features/clientes/components/ClienteScopedGastos";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { requirePermission } from "@/lib/auth/guards.server";

export default async function GastosPage() {
  const session = await requirePermission("payments:read");
  const selected = await getSelectedHecomCliente(session.id);
  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const canChangeCliente =
    capabilities.isStaff || capabilities.isSuperAdmin;

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty
          section="Gastos ads"
          mode={canChangeCliente ? "staff" : "cliente"}
        />
      </div>
    );
  }

  const data = await getHecomClienteDashboard(selected.id, {
    includeCampaignSpend: false,
  });

  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty
          section="Gastos ads"
          mode={canChangeCliente ? "staff" : "cliente"}
        />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <Suspense fallback={null}>
        <ClienteScopedGastos data={data} />
      </Suspense>
    </div>
  );
}
