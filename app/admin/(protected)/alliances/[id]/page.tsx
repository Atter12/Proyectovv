import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AllianceWorkspace } from "@/features/alliances/components/AllianceWorkspace.client";
import { getAlliance } from "@/features/alliances/lib/alliances.server";
import { todayInLima } from "@/features/alliances/lib/domain";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminAllianceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const loaded = await getAlliance(id);
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
          <Link href="/admin/alliances" className="text-sm font-semibold text-[var(--admin-accent)] hover:text-[var(--admin-accent-hover)]">
            ← Alianzas
          </Link>
        }
      />
      <AllianceWorkspace detail={detail} today={todayInLima()} />
    </>
  );
}
