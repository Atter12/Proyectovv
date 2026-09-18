import { listMissingCobroReviewsForStaff } from "@/services/payments.service";
import { ManualVoucherReviewSection } from "@/features/payments/components/ManualVoucherReviewSection.client";

interface MissingCobroVoucherReviewHostProps {
  staffMode: boolean;
  hecomClienteId?: string | null;
  clienteName?: string;
}

/**
 * Staff: claims “cobro faltante” (Lo pagado) — aprueba → insert Hecom, sin cartera.
 */
export async function MissingCobroVoucherReviewHost({
  staffMode,
  hecomClienteId,
  clienteName,
}: MissingCobroVoucherReviewHostProps) {
  if (!staffMode) return null;

  const { pending, pendingCount, scope } =
    await listMissingCobroReviewsForStaff({
      hecomClienteId: hecomClienteId ?? null,
    });

  if (pending.length === 0) {
    return (
      <section
        id="comprobantes-missing-cobro"
        className="rounded-2xl border border-dashed border-[var(--auth-divider)] px-4 py-10 text-center"
        aria-label="Sin cobros faltantes"
      >
        <p className="text-sm font-medium text-[var(--auth-text)]">
          {scope === "cliente"
            ? `Sin cobros faltantes pendientes de ${clienteName?.trim() || "este cliente"}`
            : "Sin cobros faltantes pendientes"}
        </p>
        <p className="mt-1 text-sm text-[var(--auth-muted)]">
          Solo aparecen reportes desde Lo pagado con voucher por aceptar o
          rechazar. No acreditan cartera.
        </p>
      </section>
    );
  }

  return (
    <ManualVoucherReviewSection
      mode="staff"
      product="missing_cobro"
      pending={pending}
      recent={[]}
      pendingCount={pendingCount}
      canReview
      globalQueue={scope === "all"}
    />
  );
}
