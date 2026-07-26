import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedPayments } from "@/features/clientes/components/ClienteScopedPayments";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { SelectedClienteBanner } from "@/features/clientes/components/SelectedClienteBanner.client";
import { PaymentsGatewayPanel } from "@/features/payments/components/PaymentsGatewayPanel";
import { PaymentsWalletSection } from "@/features/payments/components/PaymentsWalletSection";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { requirePermission } from "@/lib/auth/guards.server";

function StripeReturnBanner({ status }: { status?: string }) {
  if (status === "success") {
    return (
      <div
        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
        role="status"
      >
        Pago iniciado correctamente. El saldo de la cartera se acredita cuando
        Stripe confirma el webhook (unos segundos en sandbox).
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div
        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        role="status"
      >
        El checkout de Stripe se canceló. Podés intentar de nuevo cuando quieras.
      </div>
    );
  }

  return null;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("payments:read");
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const selected = await getSelectedHecomCliente();

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="pagos y movimientos" />
      </div>
    );
  }

  const data = await getHecomClienteDashboard(selected.id);
  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="pagos y movimientos" />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <SelectedClienteBanner
        clienteId={data.cliente.id}
        clienteName={data.cliente.name}
        avatarUrl={data.cliente.avatarUrl}
        detail="Arriba: recarga de cartera Holistic. Abajo: cobros/gastos Hecom de este cliente."
      />

      <StripeReturnBanner status={status} />

      {/* Cartera org — Stripe/manual (no reemplaza historial Hecom) */}
      <section className="space-y-4" aria-labelledby="wallet-topup-heading">
        <div className="dashboard-surface-card rounded-[1.5rem] p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary-deep)]">
            Cartera Holistic
          </p>
          <h2
            id="wallet-topup-heading"
            className="font-display mt-1 text-xl font-medium tracking-tight text-[#141210] sm:text-[1.35rem]"
          >
            Recargar saldo
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6b645c]">
            Recargá la cartera de tu organización (Stripe o transferencia). Es
            independiente del historial de cobros/gastos del cliente en Hecom.
          </p>
        </div>

        <PaymentsWalletSection session={session} />
        <PaymentsGatewayPanel session={session} />
      </section>

      <div
        className="border-t border-[rgb(20_18_16_/_0.1)] pt-2"
        aria-label="Historial Hecom del cliente"
      >
        <ClienteScopedPayments data={data} />
      </div>
    </div>
  );
}
