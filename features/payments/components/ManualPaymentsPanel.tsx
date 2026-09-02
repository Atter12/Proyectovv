import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { ManualVoucherReviewHost } from "@/features/payments/components/ManualVoucherReviewHost";
import type { SessionUser } from "@/types/auth";

/** @deprecated Prefer ManualVoucherReviewHost. */
export async function ManualPaymentsPanel({
  session,
}: {
  session: SessionUser;
}) {
  const caps = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  return (
    <ManualVoucherReviewHost
      session={session}
      staffMode={caps.isStaff || caps.isSuperAdmin}
    />
  );
}
