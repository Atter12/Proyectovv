import { listManualVoucherReviewsForStaff } from "@/services/payments.service";
import { ManualVoucherReviewSection } from "@/features/payments/components/ManualVoucherReviewSection.client";

interface ManualVoucherReviewHostProps {
  staffMode: boolean;
  /** Cliente Hecom seleccionado: la cola se limita a sus boletas. */
  hecomClienteId: string;
  clienteName?: string;
}

/**
 * Solo gerentes/staff: boletas de Pago manual del cliente operativo.
 */
export async function ManualVoucherReviewHost({
  staffMode,
  hecomClienteId,
  clienteName,
}: ManualVoucherReviewHostProps) {
  if (!staffMode) return null;

  const { pending, recent, pendingCount } =
    await listManualVoucherReviewsForStaff({ hecomClienteId });

  if (pending.length === 0 && recent.length === 0) {
    return (
      <section
        id="comprobantes"
        className="rounded-2xl border border-dashed border-[var(--auth-divider)] px-4 py-10 text-center"
        aria-label="Sin boletas de este cliente"
      >
        <p className="text-sm font-medium text-[var(--auth-text)]">
          Sin pagos manuales de {clienteName?.trim() || "este cliente"}
        </p>
        <p className="mt-1 text-sm text-[var(--auth-muted)]">
          Acá solo aparecen boletas BCP que subió este cliente (o se crearon con
          él seleccionado). Cambiá de cliente en el selector si buscás otra
          cola.
        </p>
      </section>
    );
  }

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
