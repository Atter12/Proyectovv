import { Suspense } from "react";
import { after } from "next/server";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedPayments } from "@/features/clientes/components/ClienteScopedPayments";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { PaymentsGatewayPanel } from "@/features/payments/components/PaymentsGatewayPanel";
import { PaymentsPageHero } from "@/features/payments/components/PaymentsPageHero";
import { PaymentsSectionSkeleton } from "@/features/payments/components/PaymentsSectionSkeleton";
import { PaymentsWalletSection } from "@/features/payments/components/PaymentsWalletSection";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { reverseOrphanedAgencyBmBridges } from "@/lib/payments/cleanup-orphaned-agency-bridges.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { requirePermission } from "@/lib/auth/guards.server";

function StripeReturnBanner({ status }: { status?: string }) {
  if (status === "success") {
    return (
      <div
        className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-950"
        role="status"
      >
        Pago ok. En unos segundos se acredita en la cartera. Después andá a{" "}
        <a
          href="#asignar-saldo"
          className="font-bold text-emerald-900 underline underline-offset-2"
        >
          Asignar saldo
        </a>{" "}
        y pasalo a una cuenta TikTok.
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div
        className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950"
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
  const selected = await getSelectedHecomCliente(session.id);
  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const canChangeCliente =
    capabilities.isStaff || capabilities.isSuperAdmin;

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty
          section="pagos y fondeo"
          mode={canChangeCliente ? "staff" : "cliente"}
        />
      </div>
    );
  }

  const data = await getHecomClienteDashboard(selected.id);
  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty
          section="pagos y fondeo"
          mode={canChangeCliente ? "staff" : "cliente"}
        />
      </div>
    );
  }

  const cliente = data.cliente;
  // Incluye match BM por nombre (no solo mapeo Hecom) — igual que Cuentas ads.
  const adsOverview = await getHecomClienteAdAccountsOverview(cliente.id);
  const hecomAdvertiserIds = adsOverview.accounts
    .map((account) => account.externalAccountId?.trim())
    .filter((id): id is string => Boolean(id));

  const hecomFinance = {
    saldoEstimado: data.summary.saldoEstimado,
    cobroTotal: data.summary.cobroTotal,
    gastoTotal: data.summary.gastoTotal,
    feeTotal: data.summary.feeTotal,
  };

  // Si overview aún viene vacío (cold TikTok), el panel fuerza live + mirror de org.

  if (capabilities.isStaff && session.organizationId) {
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

  const introCopy = capabilities.canSwitchFundingModes
    ? `Super admin: operá como Cliente (Stripe) o Gerente (cash BM) para ${cliente.name}. Abajo: historial Hecom.`
    : capabilities.canAgencyBmFund
      ? `Modo gerente: fondeá cuentas de ${cliente.name} desde cash del BM (sin Stripe). Saldo estimado Hecom arriba y en el historial.`
      : `Recargá con Stripe y asigná saldo a las cuentas de ${cliente.name}. Abajo: historial Hecom.`;

  return (
    <div className={dashboardClasses.page}>
      <StripeReturnBanner status={status} />

      <PaymentsPageHero
        cliente={cliente}
        capabilities={capabilities}
        introCopy={introCopy}
        hecomFinance={hecomFinance}
      />

      <Suspense fallback={<PaymentsSectionSkeleton rows={1} />}>
        <PaymentsWalletSection
          session={session}
          staffMode={capabilities.isStaff}
          hecomFinance={hecomFinance}
          clienteName={cliente.name}
        />
      </Suspense>

      <Suspense fallback={<PaymentsSectionSkeleton rows={2} />}>
        <PaymentsGatewayPanel
          session={session}
          hecomAdvertiserIds={hecomAdvertiserIds}
          hecomClienteId={cliente.id}
          clienteName={cliente.name}
          hecomFinance={hecomFinance}
          skipOrphanCleanup
          skipApprovedSync={isStripeReturn}
        />
      </Suspense>

      <div
        className="border-t border-[var(--auth-divider)] pt-2"
        aria-label={`Historial Hecom de ${cliente.name}`}
      >
        <ClienteScopedPayments
          data={data}
          staffMode={capabilities.isStaff || capabilities.canAgencyBmFund}
        />
      </div>
    </div>
  );
}
