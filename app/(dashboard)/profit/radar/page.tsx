import { notFound } from "next/navigation";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { RadarPageClient } from "@/features/profit/radar/components/RadarPageClient.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { getActingAsCliente, getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { canSeeRadar } from "@/lib/radar/api-context.server";

export default async function ProfitRadarPage() {
  const session = await requirePermission("adAccounts:read");
  const { allowed, isStaff } = await canSeeRadar(session);
  // Mientras PROFIT_RADAR_ENABLED esté apagado (o solo staff), la ruta no existe para el resto.
  if (!allowed) notFound();

  const actingAsCliente = await getActingAsCliente(session.id);
  const mode = isStaff || actingAsCliente ? "staff" : "cliente";
  const selected = await getSelectedHecomCliente(session.id);

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="Profit" mode={mode} />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <RadarPageClient clienteName={selected.name} />
    </div>
  );
}
