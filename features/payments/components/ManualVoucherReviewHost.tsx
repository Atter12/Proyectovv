import { listManualVoucherReviewsForStaff } from "@/services/payments.service";
import { ManualVoucherReviewSection } from "@/features/payments/components/ManualVoucherReviewSection.client";

interface ManualVoucherReviewHostProps {
  staffMode: boolean;
  /**
   * Si viene, filtra a ese cliente Hecom.
   * Si no, muestra la cola global de todos los clientes.
   */
  hecomClienteId?: string | null;
  clienteName?: string;
}

/**
 * Solo gerentes/staff: boletas de Pago manual (global o filtradas).
 */
export async function ManualVoucherReviewHost({
  staffMode,
  hecomClienteId,
  clienteName,
}: ManualVoucherReviewHostProps) {
  if (!staffMode) return null;

  const { pending, recent, pendingCount, scope } =
    await listManualVoucherReviewsForStaff({
      hecomClienteId: hecomClienteId ?? null,
    });

  if (pending.length === 0 && recent.length === 0) {
    return (
      <section
        id="comprobantes"
        className="rounded-2xl border border-dashed border-[var(--auth-divider)] px-4 py-10 text-center"
        aria-label="Sin boletas"
      >
        <p className="text-sm font-medium text-[var(--auth-text)]">
          {scope === "cliente"
            ? `Sin pagos manuales de ${clienteName?.trim() || "este cliente"}`
            : "Sin pagos manuales en cola"}
        </p>
        <p className="mt-1 text-sm text-[var(--auth-muted)]">
          {scope === "cliente"
            ? "Acá solo aparecen boletas BCP de este cliente. Quitá el filtro para ver todos."
            : "Cuando un cliente suba una boleta BCP, aparece acá para aceptar o rechazar."}
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
      globalQueue={scope === "all"}
    />
  );
}
