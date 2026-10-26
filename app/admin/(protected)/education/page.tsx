import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EducationLoomEditor } from "@/features/education/components/EducationLoomEditor.client";
import { listEducationLessons } from "@/features/education/lib/lessons.server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminEducationPage() {
  await requireAdmin();
  const [team, clients] = await Promise.all([
    listEducationLessons("gerente"),
    listEducationLessons("cliente"),
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Contenido"
        title="Educación"
        description="Cada público tiene su propia educación. Los tutoriales del equipo solo los ven los gerentes; los de clientes son los que ve el cliente en su panel."
      />
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--admin-text)]">Equipo (gerentes)</h2>
          <EducationLoomEditor lessons={team} audience="gerente" tone="admin" />
        </section>
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--admin-text)]">Clientes</h2>
          <EducationLoomEditor lessons={clients} audience="cliente" tone="admin" />
        </section>
      </div>
    </>
  );
}
