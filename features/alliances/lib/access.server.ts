import "server-only";
import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { userIsAllowedAdmin } from "@/lib/admin/allowlist";
import { requireSession } from "@/lib/auth/guards.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

/** Gerente, super admin o allowlist de admin. El cliente final no entra. */
export async function requireAllianceStaff() {
  const session = await requireSession();
  const funding = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const isAdmin = userIsAllowedAdmin({ id: session.id, email: session.email });
  if (!funding.isStaff && !funding.isSuperAdmin && !isAdmin) {
    redirect(routes.overview);
  }
  return session;
}
