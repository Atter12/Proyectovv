import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { EducationCenter } from "@/features/education/components/EducationCenter.client";
import { canViewEducation } from "@/features/education/lib/access";
import { listEducationLessons } from "@/features/education/lib/lessons.server";
import { requireSession } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

export default async function EducationPage() {
  const session = await requireSession();
  if (!canViewEducation(session.email)) {
    redirect(routes.overview);
  }
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const actingAsCliente = await getActingAsCliente(session.id);
  const canManage =
    (funding.isStaff || funding.isSuperAdmin) && !actingAsCliente;
  const lessons = await listEducationLessons();

  return <EducationCenter lessons={lessons} canManage={canManage} />;
}
