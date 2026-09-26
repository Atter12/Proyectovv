import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AllianceCalendar } from "@/features/alliances/components/AllianceCalendar.client";
import { AllianceModuleNav } from "@/features/alliances/components/AllianceModuleNav";
import { listAlliances } from "@/features/alliances/lib/alliances.server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminAllianceCalendarPage() {
  await requireAdmin();
  const loaded = await listAlliances();

  return (
    <>
      <AdminPageHeader
        eyebrow="Marketing"
        title="Calendario de alianzas"
        description="Vencimientos de contrato y seguimientos abiertos, con enlace a la ficha."
        actions={<AllianceModuleNav basePath="/admin/alliances" current="calendario" />}
      />
      {loaded.ok ? (
        <AllianceCalendar today={loaded.data.today} events={loaded.data.events} basePath="/admin/alliances" />
      ) : (
        <p className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-sm text-[var(--admin-text-muted)]">
          No se pudo cargar el calendario.
        </p>
      )}
    </>
  );
}
