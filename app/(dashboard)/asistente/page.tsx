import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { OpsAssistant } from "@/features/ops/OpsAssistant.client";
import { requireSession } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

export default async function AsistentePage() {
  const session = await requireSession();
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!funding.isStaff && !funding.isSuperAdmin) {
    redirect(routes.overview);
  }
  if (await getActingAsCliente(session.id)) {
    redirect(routes.overview);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <OpsAssistant />
    </div>
  );
}
