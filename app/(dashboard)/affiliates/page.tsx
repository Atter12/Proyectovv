import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedAffiliates } from "@/features/clientes/components/ClienteScopedAffiliates";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { SelectedClienteBanner } from "@/features/clientes/components/SelectedClienteBanner.client";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { requirePermission } from "@/lib/auth/guards.server";

export default async function AffiliatesPage() {
  await requirePermission("affiliates:read");
  const selected = await getSelectedHecomCliente();

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="el programa de afiliados" />
      </div>
    );
  }

  const data = await getHecomClienteDashboard(selected.id);
  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="el programa de afiliados" />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <SelectedClienteBanner
        clienteId={data.cliente.id}
        clienteName={data.cliente.name}
        avatarUrl={data.cliente.avatarUrl}
        detail="Afiliados no existen por cliente en Hecom; el resto del panel sí queda filtrado."
      />
      <ClienteScopedAffiliates data={data} />
    </div>
  );
}
