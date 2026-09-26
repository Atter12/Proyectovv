import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { routes } from "@/config/routes";
import { AllianceWorkspace } from "@/features/alliances/components/AllianceWorkspace.client";
import { requireAllianceStaff } from "@/features/alliances/lib/access.server";
import { getAlliance } from "@/features/alliances/lib/alliances.server";
import { todayInLima } from "@/features/alliances/lib/domain";
import { listContractTemplates } from "@/features/alliances/lib/templates.server";
import { signatureProviderReady } from "@/features/alliances/lib/signature.server";

export const dynamic = "force-dynamic";

export default async function AllianceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAllianceStaff();
  const { id } = await params;
  const [loaded, templates] = await Promise.all([getAlliance(id), listContractTemplates()]);
  if (!loaded.ok) {
    return (
      <AdminPageHeader
        eyebrow="Marketing"
        title="Alianza"
        description={
          loaded.error === "missing_table"
            ? "Falta aplicar la migración supabase/migrations/037_alliances.sql."
            : "No se pudo abrir esta alianza."
        }
      />
    );
  }
  if (!loaded.data) notFound();
  const detail = loaded.data;

  return (
    <>
      <AdminPageHeader
        eyebrow="Ficha de alianza"
        title={detail.name}
        description={detail.summary || "Relación comercial, documentos y siguiente acción en un solo lugar."}
        actions={
          <Link href={routes.alliances} className="text-sm font-semibold text-[var(--admin-accent)] hover:text-[var(--admin-accent-hover)]">
            ← Alianzas
          </Link>
        }
      />
      <AllianceWorkspace
        detail={detail}
        today={todayInLima()}
        basePath={routes.alliances}
        templates={templates.ok ? templates.data : null}
        signatureReady={signatureProviderReady()}
      />
    </>
  );
}
