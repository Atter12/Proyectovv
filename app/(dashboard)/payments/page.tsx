import { Suspense } from "react";
import { after } from "next/server";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedPayments } from "@/features/clientes/components/ClienteScopedPayments";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import { PaymentsGatewayPanel } from "@/features/payments/components/PaymentsGatewayPanel";
import { PaymentsMoneyFlowGuide } from "@/features/payments/components/PaymentsMoneyFlowGuide";
import { PaymentsSectionSkeleton } from "@/features/payments/components/PaymentsSectionSkeleton";
import { PaymentsWalletSection } from "@/features/payments/components/PaymentsWalletSection";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { reverseOrphanedAgencyBmBridges } from "@/lib/payments/cleanup-orphaned-agency-bridges.server";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";
import { requirePermission } from "@/lib/auth/guards.server";
import Link from "next/link";

function StripeReturnBanner({ status }: { status?: string }) {
  if (status === "success") {
    return (
      <div
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-950"
        role="status"
      >
        Pago ok. En unos segundos se acredita en la cartera. Después andá a{" "}
        <a
          href="#asignar-saldo"
          className="font-semibold underline underline-offset-2"
        >
          Asignar saldo
        </a>{" "}
        y pasalo a una cuenta TikTok para que las campañas puedan gastar.
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950"
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
  const isStripeReturn = status === "success" || status === "cancelled";
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

  const cliente = data.cliente;
  const hecomAdvertiserIds = data.accounts
    .map((account) => account.advertiserId?.trim())
    .filter((id): id is string => Boolean(id));

  const isStaff =
    isHecomOtpStaffEmail(session.email) ||
    session.role === "owner" ||
    session.role === "admin";

  // Cleanup fuera del path crítico (no bloquea el HTML al volver de Stripe).
  if (isStaff && session.organizationId) {
    const organizationId = session.organizationId;
    after(async () => {
      try {
        await reverseOrphanedAgencyBmBridges({ organizationId });
      } catch (error) {
        console.error("[payments] orphan_bridge_cleanup_skipped", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    });
  }

  return (
    <div className={dashboardClasses.page}>
      <StripeReturnBanner status={status} />

      <section
        className="overflow-hidden rounded-[1.25rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]"
        aria-labelledby="wallet-topup-heading"
      >
        <div className="relative px-5 py-5 sm:px-6 sm:py-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgb(255_120_31_/_0.06),transparent)]"
          />
          <div className="relative">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a5a38]">
              Cartera Holistic · vs · TikTok Ads
            </p>
            <h2
              id="wallet-topup-heading"
              className="mt-1.5 text-[1.35rem] font-medium tracking-[-0.015em] text-[#1a1612] sm:text-[1.45rem]"
            >
              Recargar y fondear ads
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
              Dos caminos: <strong className="font-medium text-[#1a1612]">Cliente</strong>{" "}
              recarga con Stripe/manual y asigna;{" "}
              <strong className="font-medium text-[#1a1612]">Gerente</strong>{" "}
              fondea desde cash del BM sin Stripe. Elegí arriba y operá solo
              cuentas de {cliente.name}. Abajo: historial Hecom.
            </p>

            <div className="mt-4">
              <PaymentsMoneyFlowGuide />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <HecomClienteAvatar
                name={cliente.name}
                avatarUrl={cliente.avatarUrl}
                size="sm"
                className="ring-1 ring-white shadow-sm"
              />
              <p className="text-[13px] font-medium text-[#1a1612]">
                {cliente.name}
              </p>
              <Link
                href={`/clientes/${cliente.id}`}
                className="text-[12px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
              >
                Ver ficha
              </Link>
            </div>

            <p className="mt-4 rounded-lg border border-[rgb(20_18_16_/_0.06)] bg-[#faf7f3] px-3.5 py-2.5 text-[13px] leading-5 text-[#4a443c]">
              Recargás arriba para fondear; abajo solo ves el historial de lo ya
              cobrado y gastado de {cliente.name}.
            </p>
          </div>
        </div>
      </section>

      <Suspense fallback={<PaymentsSectionSkeleton rows={1} />}>
        <PaymentsWalletSection session={session} staffMode={isStaff} />
      </Suspense>

      <Suspense fallback={<PaymentsSectionSkeleton rows={2} />}>
        <PaymentsGatewayPanel
          session={session}
          hecomAdvertiserIds={hecomAdvertiserIds}
          hecomClienteId={cliente.id}
          clienteName={cliente.name}
          skipOrphanCleanup
          skipApprovedSync={isStripeReturn}
        />
      </Suspense>

      <div
        className="border-t border-[rgb(20_18_16_/_0.08)] pt-2"
        aria-label={`Historial Hecom de ${cliente.name}`}
      >
        <ClienteScopedPayments data={data} />
      </div>
    </div>
  );
}
