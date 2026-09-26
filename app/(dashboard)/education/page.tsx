import { EducationCenter } from "@/features/education/components/EducationCenter.client";
import { listEducationLessons } from "@/features/education/lib/lessons.server";
import { requireSession } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

export default async function EducationPage() {
  const session = await requireSession();
  const funding = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const actingAsCliente = await getActingAsCliente(session.id);
  const canManage =
    (funding.isStaff || funding.isSuperAdmin) && !actingAsCliente;
  const lessons = await listEducationLessons();

  return <EducationCenter lessons={lessons} canManage={canManage} />;
}
