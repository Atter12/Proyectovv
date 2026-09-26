import "server-only";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export async function isSupportStaff(email: string, role: string | null | undefined) {
  const funding = await resolvePaymentsFundingCapabilities({ email, role });
  return funding.isStaff || funding.isSuperAdmin;
}
