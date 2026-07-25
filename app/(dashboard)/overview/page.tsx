import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedOverview } from "@/features/clientes/components/ClienteScopedOverview";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { SelectedClienteBanner } from "@/features/clientes/components/SelectedClienteBanner.client";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { requireSession } from "@/lib/auth/guards.server";

export default async function OverviewPage() {
  await requireSession();
  const selected = await getSelectedHecomCliente();

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="la descripción general" />
      </div>
    );
  }

  const data = await getHecomClienteDashboard(selected.id);
  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="la descripción general" />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <SelectedClienteBanner
        clienteId={data.cliente.id}
        clienteName={data.cliente.name}
        avatarUrl={data.cliente.avatarUrl}
        detail="Overview solo de este cliente (cuentas, cobros y gastos Hecom)."
      />
      <ClienteScopedOverview data={data} />
    </div>
  );
}
