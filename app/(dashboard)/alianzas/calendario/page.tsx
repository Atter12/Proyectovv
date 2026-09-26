import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { routes } from "@/config/routes";
import { AllianceCalendar } from "@/features/alliances/components/AllianceCalendar.client";
import { AllianceModuleNav } from "@/features/alliances/components/AllianceModuleNav";
import { requireAllianceStaff } from "@/features/alliances/lib/access.server";
import { listAlliances } from "@/features/alliances/lib/alliances.server";

export const dynamic = "force-dynamic";

export default async function AllianceCalendarPage() {
  await requireAllianceStaff();
  const loaded = await listAlliances();

  return (
    <>
      <AdminPageHeader
        eyebrow="Marketing"
        title="Calendario de alianzas"
        description="Vencimientos de contrato y seguimientos abiertos, con enlace a la ficha."
        actions={<AllianceModuleNav basePath={routes.alliances} current="calendario" />}
      />
      {loaded.ok ? (
        <AllianceCalendar today={loaded.data.today} events={loaded.data.events} basePath={routes.alliances} />
      ) : (
        <p className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-sm text-[var(--admin-text-muted)]">
          No se pudo cargar el calendario.
        </p>
      )}
    </>
  );
}
