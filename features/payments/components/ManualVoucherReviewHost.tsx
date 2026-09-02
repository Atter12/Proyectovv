import { listManualVoucherReviewsForStaff } from "@/services/payments.service";
import { ManualVoucherReviewSection } from "@/features/payments/components/ManualVoucherReviewSection.client";

interface ManualVoucherReviewHostProps {
  staffMode: boolean;
}

/**
 * Solo gerentes/staff: cola de boletas en revisión (página dedicada).
 * El cliente no ve historial acá — solo sube el comprobante en Pago manual.
 */
export async function ManualVoucherReviewHost({
  staffMode,
}: ManualVoucherReviewHostProps) {
  if (!staffMode) return null;

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
