import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedOverview } from "@/features/clientes/components/ClienteScopedOverview";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
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
        <PickClienteEmpty section="la descripción general" />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <ClienteScopedOverview data={data} />
    </div>
  );
}
