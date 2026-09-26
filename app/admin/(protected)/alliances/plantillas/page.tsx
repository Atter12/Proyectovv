import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AllianceModuleNav } from "@/features/alliances/components/AllianceModuleNav";
import { ContractTemplateManager } from "@/features/alliances/components/ContractTemplateManager.client";
import { listContractTemplates } from "@/features/alliances/lib/templates.server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminAllianceTemplatesPage() {
  await requireAdmin();
  const loaded = await listContractTemplates();

  return (
    <>
      <AdminPageHeader
        eyebrow="Marketing"
        title="Plantillas de contrato"
        description="Textos reutilizables. Al generar un contrato, la ficha completa las variables y deja un borrador."
        actions={<AllianceModuleNav basePath="/admin/alliances" current="plantillas" />}
      />
      {loaded.ok ? (
        <ContractTemplateManager templates={loaded.data} backHref="/admin/alliances" />
      ) : (
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-sm text-[var(--admin-text-muted)]">
          {loaded.error === "missing_table"
            ? "Falta aplicar supabase/migrations/039_alliance_contract_templates.sql. Ahí vienen Alianza comercial, NDA y Adenda."
            : "No se pudieron cargar las plantillas."}
        </div>
      )}
    </>
  );
}
