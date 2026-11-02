import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { BusinessSimulator } from "@/features/business-simulator/BusinessSimulator.client";

export default async function SimulatorPage() {
  const session = await requirePermission("payments:read");
  const capabilities = await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role });
  if ((!capabilities.isStaff && !capabilities.isSuperAdmin) || await getActingAsCliente(session.id)) redirect("/overview");
  return <BusinessSimulator />;
}
