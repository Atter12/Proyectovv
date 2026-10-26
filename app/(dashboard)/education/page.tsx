import { EducationCenter } from "@/features/education/components/EducationCenter.client";
import type { EducationAudience } from "@/features/education/lib/catalog";
import { listEducationLessons } from "@/features/education/lib/lessons.server";
import { requireSession } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

export default async function EducationPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string | string[] }>;
}) {
  const session = await requireSession();
  const funding = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const actingAsCliente = await getActingAsCliente(session.id);
  const canManage =
    (funding.isStaff || funding.isSuperAdmin) && !actingAsCliente;
  // El gerente entra a la educación del equipo y puede pasar a la de clientes;
  // el cliente solo recibe la suya, la del equipo nunca sale del servidor.
  const { ver } = await searchParams;
  const audience: EducationAudience =
    canManage && ver !== "clientes" ? "gerente" : "cliente";
  const all = await listEducationLessons(audience);
  const lessons = canManage ? all : all.filter((lesson) => lesson.active);

  return <EducationCenter lessons={lessons} canManage={canManage} audience={audience} />;
}
