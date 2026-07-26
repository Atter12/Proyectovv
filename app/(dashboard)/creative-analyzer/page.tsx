import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedCreatives } from "@/features/clientes/components/ClienteScopedCreatives";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { requirePermission } from "@/lib/auth/guards.server";

export default async function CreativeAnalyzerPage() {
  await requirePermission("creativeAnalyzer:read");
  const selected = await getSelectedHecomCliente();

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="el analizador creativo" />
      </div>
    );
  }

  const data = await getHecomClienteDashboard(selected.id);
  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="el analizador creativo" />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <ClienteScopedCreatives data={data} />
    </div>
  );
}
