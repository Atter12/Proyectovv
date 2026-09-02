import { listManualVoucherReviewsForStaff } from "@/services/payments.service";
import { ManualVoucherReviewSection } from "@/features/payments/components/ManualVoucherReviewSection.client";
import type { SessionUser } from "@/types/auth";

interface ManualVoucherReviewHostProps {
  session: SessionUser;
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

  // Solo manual con voucher real; sin cripto expirado / “falta voucher”.
  const pendingManual = pending.filter(
    (i) =>
      i.provider === "manual" &&
      i.reviewStatus === "pending_review" &&
      Boolean(i.proofFileName),
  );
  const recentManual = recent.filter(
    (i) =>
      i.provider === "manual" &&
      (i.reviewStatus === "approved" || i.reviewStatus === "rejected") &&
      Boolean(i.proofFileName),
  );

  if (pendingManual.length === 0 && recentManual.length === 0) return null;

  return (
    <ManualVoucherReviewSection
      mode="staff"
      pending={pendingManual}
      recent={recentManual}
      pendingCount={pendingManual.length}
      canReview
    />
  );
}
