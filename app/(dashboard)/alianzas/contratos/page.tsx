import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { routes } from "@/config/routes";
import { AllianceContractQueue } from "@/features/alliances/components/AllianceContractQueue.client";
import { AllianceModuleNav } from "@/features/alliances/components/AllianceModuleNav";
import { requireAllianceStaff } from "@/features/alliances/lib/access.server";
import { listAlliances } from "@/features/alliances/lib/alliances.server";

export const dynamic = "force-dynamic";

export default async function AllianceContractsPage() {
  await requireAllianceStaff();
  const loaded = await listAlliances();

  return (
    <>
      <AdminPageHeader
        eyebrow="Marketing"
        title="Contratos"
        description="Borradores, pendientes de firma, firmados y los que vencen pronto."
        actions={<AllianceModuleNav basePath={routes.alliances} current="contratos" />}
      />
      {loaded.ok ? (
        <AllianceContractQueue rows={loaded.data.queue} basePath={routes.alliances} />
      ) : (
        <p className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-sm text-[var(--admin-text-muted)]">
          No se pudieron cargar los contratos.
        </p>
      )}
    </>
  );
}
