import { listRealProfitVoucherReviewsForStaff } from "@/services/payments.service";
import { ManualVoucherReviewSection } from "@/features/payments/components/ManualVoucherReviewSection.client";

interface RealProfitVoucherReviewHostProps {
  staffMode: boolean;
  hecomClienteId?: string | null;
  clienteName?: string;
}

/**
 * Solo gerentes/staff: boletas Real Profit COD (+$20).
 */
export async function RealProfitVoucherReviewHost({
  staffMode,
  hecomClienteId,
  clienteName,
}: RealProfitVoucherReviewHostProps) {
  if (!staffMode) return null;

  const { pending, pendingCount, scope } =
    await listRealProfitVoucherReviewsForStaff({
      hecomClienteId: hecomClienteId ?? null,
    });

  if (pending.length === 0) {
    return (
      <section
        id="comprobantes-profit"
        className="rounded-2xl border border-dashed border-[var(--auth-divider)] px-4 py-10 text-center"
        aria-label="Sin boletas Profit"
      >
        <p className="text-sm font-medium text-[var(--auth-text)]">
          {scope === "cliente"
            ? `Sin pagos Real Profit pendientes de ${clienteName?.trim() || "este cliente"}`
            : "Sin pagos Real Profit pendientes"}
        </p>
        <p className="mt-1 text-sm text-[var(--auth-muted)]">
          Solo aparecen depósitos de $20 COD con voucher por aceptar o rechazar.
        </p>
      </section>
    );
  }

  return (
    <ManualVoucherReviewSection
      mode="staff"
      product="realprofit"
      pending={pending}
      recent={[]}
      pendingCount={pendingCount}
      canReview
      globalQueue={scope === "all"}
    />
  );
}
