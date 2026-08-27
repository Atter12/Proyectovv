import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedCobros } from "@/features/clientes/components/ClienteScopedCobros";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { requirePermission } from "@/lib/auth/guards.server";

export default async function CobrosPage() {
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
          section="Lo pagado"
          mode={canChangeCliente ? "staff" : "cliente"}
        />
      </div>
    );
  }

  const data = await getHecomClienteDashboard(selected.id, {
    includeCampaignSpend: false,
    includeCreativos: false,
    includeDailySpend: false,
  });

  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty
          section="Lo pagado"
          mode={canChangeCliente ? "staff" : "cliente"}
        />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <ClienteScopedCobros data={data} />
    </div>
  );
}
