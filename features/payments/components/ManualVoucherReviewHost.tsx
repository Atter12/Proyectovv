import {
  getRecentManualPaymentIntents,
  listManualVoucherReviewsForStaff,
} from "@/services/payments.service";
import { ManualVoucherReviewSection } from "@/features/payments/components/ManualVoucherReviewSection.client";
import type { SessionUser } from "@/types/auth";

interface ManualVoucherReviewHostProps {
  session: SessionUser;
  staffMode: boolean;
}

export async function ManualVoucherReviewHost({
  session,
  staffMode,
}: ManualVoucherReviewHostProps) {
  if (staffMode) {
    const { pending, recent, pendingCount } =
      await listManualVoucherReviewsForStaff();
    return (
      <ManualVoucherReviewSection
        mode="staff"
        pending={pending}
        recent={recent}
        pendingCount={pendingCount}
        canReview
      />
    );
  }

  const clientItems = await getRecentManualPaymentIntents(session);
  return (
    <ManualVoucherReviewSection
      mode="client"
      pending={[]}
      recent={[]}
      pendingCount={0}
      canReview={false}
      clientItems={clientItems}
    />
  );
}
