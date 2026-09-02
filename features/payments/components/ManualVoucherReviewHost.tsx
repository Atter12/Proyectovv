import { listManualVoucherReviewsForStaff } from "@/services/payments.service";
import { ManualVoucherReviewSection } from "@/features/payments/components/ManualVoucherReviewSection.client";

interface ManualVoucherReviewHostProps {
  staffMode: boolean;
}

/**
 * Solo gerentes/staff: cola de boletas en revisión.
 * El cliente no ve historial acá — solo sube el comprobante en Pago manual.
 */
export async function ManualVoucherReviewHost({
  staffMode,
}: ManualVoucherReviewHostProps) {
  if (!staffMode) return null;

  const { pending, recent, pendingCount } =
    await listManualVoucherReviewsForStaff();

  if (pending.length === 0 && recent.length === 0) return null;

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
