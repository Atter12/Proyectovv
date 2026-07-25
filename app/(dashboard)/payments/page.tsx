import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedPayments } from "@/features/clientes/components/ClienteScopedPayments";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { SelectedClienteBanner } from "@/features/clientes/components/SelectedClienteBanner.client";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { requirePermission } from "@/lib/auth/guards.server";

export default async function PaymentsPage() {
  await requirePermission("payments:read");
  const selected = await getSelectedHecomCliente();

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="pagos y movimientos" />
      </div>
    );
  }

  const data = await getHecomClienteDashboard(selected.id);
  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="pagos y movimientos" />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <SelectedClienteBanner
        clienteId={data.cliente.id}
        clienteName={data.cliente.name}
        detail="Solo cobros y gastos de este cliente en Hecom."
      />
      <ClienteScopedPayments data={data} />
    </div>
  );
}
