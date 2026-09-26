import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AllianceList } from "@/features/alliances/components/AllianceList.client";
import { AllianceModuleNav } from "@/features/alliances/components/AllianceModuleNav";
import { listAlliances } from "@/features/alliances/lib/alliances.server";
import { requireAllianceStaff } from "@/features/alliances/lib/access.server";
import { routes } from "@/config/routes";

export const dynamic = "force-dynamic";

export default async function AlliancesPage() {
  await requireAllianceStaff();
  const loaded = await listAlliances();

  return (
    <>
      <AdminPageHeader
        eyebrow="Marketing"
        title="Alianzas"
        description="Centro de relaciones comerciales: qué se acordó, qué contrato lo respalda y cuál es la siguiente acción."
        actions={<AllianceModuleNav basePath={routes.alliances} current="resumen" />}
      />
      {loaded.ok ? (
        <AllianceList
          today={loaded.data.today}
          rows={loaded.data.rows}
          stats={loaded.data.stats}
          followup={loaded.data.followup}
          byType={loaded.data.byType}
          owners={loaded.data.owners}
          alertsReady={loaded.data.alertsReady}
          basePath={routes.alliances}
        />
      ) : (
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-sm text-[var(--admin-text-muted)]">
          {loaded.error === "missing_table"
            ? "La base todavía no tiene las tablas de alianzas. Aplica la migración supabase/migrations/037_alliances.sql y vuelve a abrir este módulo."
            : "No se pudo cargar el módulo de alianzas. Revisa la conexión con Supabase e inténtalo de nuevo."}
        </div>
      )}
    </>
  );
}
