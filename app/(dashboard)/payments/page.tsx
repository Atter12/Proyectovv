import { Suspense } from "react";
import { after } from "next/server";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedPayments } from "@/features/clientes/components/ClienteScopedPayments";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { PaymentsGatewayPanel } from "@/features/payments/components/PaymentsGatewayPanel";
import { PaymentsPageHero } from "@/features/payments/components/PaymentsPageHero";
import { PaymentsSectionSkeleton } from "@/features/payments/components/PaymentsSectionSkeleton";
import { CreditLockPanel } from "@/features/payments/components/CreditLockPanel.client";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";
import { getSelectedHecomCliente, getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { reverseOrphanedAgencyBmBridges } from "@/lib/payments/cleanup-orphaned-agency-bridges.server";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import { resolveHecomBillingModality } from "@/lib/hecom/clientes.server";
import { requirePermission } from "@/lib/auth/guards.server";

function StripeReturnBanner({ status }: { status?: string }) {
  if (status === "success") {
    return (
      <div
        className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-950"
        role="status"
      >
        Pago confirmado. En unos segundos se acreditará en la cartera. Luego ve a{" "}
        <a
          href="#asignar-saldo"
          className="font-bold text-emerald-900 underline underline-offset-2"
        >
          Asignar saldo
        </a>{" "}
        y transfiérelo a una cuenta de TikTok.
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div
        className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950"
        role="status"
      >
        El checkout de Stripe se canceló. Puedes intentarlo de nuevo cuando quieras.
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
  const actingAsCliente = await getActingAsCliente(session.id);
  const rawCapabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const capabilities = withActAsClienteView(
    rawCapabilities,
    actingAsCliente,
  );
  const canReviewCredit =
    rawCapabilities.isStaff || rawCapabilities.isSuperAdmin;
  const canChangeCliente =
    rawCapabilities.isStaff ||
    rawCapabilities.isSuperAdmin ||
    actingAsCliente;

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty
          section="Pagos y recargas"
          mode={canChangeCliente ? "staff" : "cliente"}
        />
      </div>
    );
  }

  // Paralelizar: dashboard ligero + cuentas (cache BM). Antes: serie + TikTok live.
  const [data, adsOverview] = await Promise.all([
    getHecomClienteDashboard(selected.id, {
      includeCampaignSpend: false,
      includeCreativos: false,
      includeDailySpend: false,
    }),
    getHecomClienteAdAccountsOverview(selected.id, "fast"),
  ]);
  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty
          section="Pagos y recargas"
          mode={canChangeCliente ? "staff" : "cliente"}
        />
      </div>
    );
  }

  const cliente = data.cliente;
  // Hecom map primero; si vacío, overview (Hecom IDs o Holistic por hecom_cliente_id — nunca por nombre).
  const mappedHecomIds = (
    cliente.tiktokAccounts.length > 0
      ? cliente.tiktokAccounts.filter((a) => a.syncEnabled !== false)
      : cliente.tiktokAdvertiserId && cliente.tiktokSyncEnabled !== false
        ? [{ advertiserId: cliente.tiktokAdvertiserId }]
        : []
  )
    .map((a) => a.advertiserId.trim())
    .filter(Boolean);
  const overviewActiveIds = adsOverview.accounts
    .filter((account) => account.status !== "disabled")
    .map((account) => account.externalAccountId?.trim())
    .filter((id): id is string => Boolean(id));
  const hecomAdvertiserIds =
    mappedHecomIds.length > 0 ? mappedHecomIds : overviewActiveIds;

  console.info("[payments] page_load", {
    clienteId: cliente.id,
    ads: adsOverview.accounts.length,
    mappedHecomIds: mappedHecomIds.length,
    allocateIds: hecomAdvertiserIds.length,
    cobros: data.cobros.length,
  });

  const hecomFinance = {
    saldoEstimado: data.summary.saldoEstimado,
    cobroTotal: data.summary.cobroTotal,
    gastoTotal: data.summary.gastoTotal,
    feeTotal: data.summary.feeTotal,
    depositFeePercent: data.summary.depositFeePercent,
    billingModality: resolveHecomBillingModality(cliente),
    cobranzaRango: cliente.cobranzaRango,
  };

  // Si overview aún viene vacío (cold TikTok), el panel fuerza live + mirror de org.

  if (session.organizationId) {
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

  const introCopy =
    capabilities.canAgencyBmFund && !capabilities.canClientStripeFund
      ? `Elige una cuenta de ${cliente.name} y recárgala desde el Business Center.`
      : `Agrega saldo a la cartera de ${cliente.name} y asígnalo a una cuenta de TikTok.`;

  return (
    <div className={dashboardClasses.page}>
      <StripeReturnBanner status={status} />

      <PaymentsPageHero
        cliente={cliente}
        capabilities={capabilities}
        introCopy={introCopy}
      />

      <Suspense fallback={<PaymentsSectionSkeleton rows={2} />}>
        <PaymentsGatewayPanel
          session={session}
          hecomAdvertiserIds={hecomAdvertiserIds}
          hecomClienteId={cliente.id}
          clienteName={cliente.name}
          hecomFinance={hecomFinance}
          adsAccounts={adsOverview.accounts}
          skipOrphanCleanup
          skipApprovedSync={isStripeReturn}
          creditSlot={
            capabilities.canClientStripeFund ? (
              <CreditLockPanel
                clienteName={cliente.name}
                canReviewCredit={canReviewCredit}
              />
            ) : null
          }
        />
      </Suspense>

      <details className="group overflow-hidden rounded-2xl border border-[var(--auth-border)] bg-white">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3.5 text-[13px] font-semibold text-[var(--auth-text)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--auth-accent)]/30 sm:px-6">
          <span>Ver movimientos e historial</span>
          <span
            aria-hidden
            className="text-[var(--auth-text-soft)] transition-transform group-open:rotate-180"
          >
            ↓
          </span>
        </summary>
        <div
          className="border-t border-[var(--auth-divider)] p-4 sm:p-6"
          aria-label={`Historial Hecom de ${cliente.name}`}
        >
          <ClienteScopedPayments
            data={data}
            staffMode={capabilities.isStaff || capabilities.canAgencyBmFund}
          />
        </div>
      </details>
    </div>
  );
}
