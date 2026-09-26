import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EducationLoomEditor } from "@/features/education/components/EducationLoomEditor.client";
import { listEducationLessons } from "@/features/education/lib/lessons.server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminEducationPage() {
  await requireAdmin();
  const lessons = await listEducationLessons();

  return (
    <>
      <AdminPageHeader
        eyebrow="Contenido"
        title="Educación"
        description="Publica el título, el enlace de Loom y la imagen de cada tutorial. Sin enlace, el cliente ve la portada y el aviso de que el video aún no está disponible."
      />
      <EducationLoomEditor lessons={lessons} tone="admin" />
    </>
  );
}
