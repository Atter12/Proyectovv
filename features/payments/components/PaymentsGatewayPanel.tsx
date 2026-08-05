import { PaymentOverviewStats } from "./PaymentOverviewStats";
import { PaymentsAllocateSection } from "./PaymentsAllocateSection";
import { PaymentsGatewayBlockClient } from "./PaymentsGatewayBlock.client";
import { PaymentsFundingModeProvider } from "./PaymentsFundingModeContext.client";
import { formatMoney } from "@/lib/format-money";
import { scopeAllocationAccountsToHecomAdvertisers } from "@/lib/payments/scope-hecom-accounts";
import { reverseOrphanedAgencyBmBridges } from "@/lib/payments/cleanup-orphaned-agency-bridges.server";
import { syncApprovedAdAccountsForCliente } from "@/lib/hecom/sync-approved-ad-accounts.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { getPaymentPageCore } from "@/services/payments.service";
import type { SessionUser } from "@/types/auth";
import Link from "next/link";
import { routes } from "@/config/routes";

interface PaymentsGatewayPanelProps {
  session: SessionUser;
  hecomAdvertiserIds?: string[];
  hecomClienteId?: string;
  clienteName?: string;
  /** Si el cleanup ya corrió (o se diferió) en la página. */
  skipOrphanCleanup?: boolean;
  /**
   * Tras Stripe u otra vuelta rápida: no bloquear en sync TikTok BC.
   * Usa IDs Hecom y deja el sync cacheado para la próxima visita.
   */
  skipApprovedSync?: boolean;
}

export async function PaymentsGatewayPanel({
  session,
  hecomAdvertiserIds,
  hecomClienteId,
  clienteName,
  skipOrphanCleanup = false,
  skipApprovedSync = false,
}: PaymentsGatewayPanelProps) {
  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  if (
    !skipOrphanCleanup &&
    capabilities.isStaff &&
    session.organizationId
  ) {
    try {
      await reverseOrphanedAgencyBmBridges({
        organizationId: session.organizationId,
      });
    } catch (error) {
      console.error("[payments] orphan_bridge_cleanup_skipped", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  let approvedIds = hecomAdvertiserIds ?? [];
  let syncNote: string | null = null;

  if (
    !skipApprovedSync &&
    session.organizationId &&
    hecomClienteId
  ) {
    try {
      const sync = await syncApprovedAdAccountsForCliente({
        organizationId: session.organizationId,
        clienteId: hecomClienteId,
        userId: session.id,
      });
      if (!sync.skippedUnavailableStatus) {
        approvedIds = sync.approvedAdvertiserIds;
        if (approvedIds.length === 0) {
          syncNote =
            "No hay cuentas TikTok Aprobadas para este cliente. Revisá el BM o el mapeo en Hecom.";
        }
      } else {
        syncNote =
          "No se pudo consultar el estado en TikTok; se muestran las cuentas mapeadas en Hecom.";
      }
    } catch (error) {
      console.error("[payments] approved_sync_failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      syncNote =
        "No se pudo sincronizar cuentas aprobadas. Probá de nuevo en unos minutos.";
    }
  }

  const core = await getPaymentPageCore(session);
  const activeGateway =
    core.gateways.find((gateway) => gateway.id === core.selectedGateway) ??
    core.gateways[0]!;

  const scopedAccounts =
    hecomAdvertiserIds != null
      ? scopeAllocationAccountsToHecomAdvertisers(
          core.adAccountsForAllocation,
          approvedIds,
        ).filter((account) => account.status !== "disabled")
      : core.adAccountsForAllocation.filter(
          (account) => account.status !== "disabled",
        );

  const scopedSummary = {
    ...core.summary,
    accountsReadyForAllocation: scopedAccounts.filter(
      (a) => a.status === "active" || a.status === "pending",
    ).length,
  };

  return (
    <PaymentsFundingModeProvider capabilities={capabilities}>
      <div className="space-y-5">
        <PaymentsGatewayBlockClient
          gateways={core.gateways}
          initialSelected={core.selectedGateway}
        />

        <PaymentOverviewStats
          wallet={core.wallet}
          summary={scopedSummary}
          activeGateway={activeGateway}
          isStaff={capabilities.isStaff}
        />

        {syncNote ? (
          <p
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950"
            role="status"
          >
            {syncNote}
          </p>
        ) : null}

        {hecomAdvertiserIds != null && scopedAccounts.length === 0 ? (
          <section
            id="asignar-saldo"
            className="rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] px-5 py-5 sm:px-6"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a5a38]">
              2 · Fondear cuenta ads · {clienteName ?? "Este cliente"}
            </p>
            <h2 className="mt-1 text-[15px] font-medium text-[#1a1612]">
              Sin cuentas Aprobadas para asignar
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
              Solo listamos advertisers en estado <strong>Aprobado</strong> en
              TikTok. Si {clienteName ?? "este cliente"} tiene cuentas
              suspendidas, no aparecen acá. Activá/aprobá en el BM o mapeá la
              cuenta correcta en Hecom.
            </p>
            <Link
              href={routes.adAccounts}
              className="mt-3 inline-flex text-[13px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
            >
              Ver cuentas del cliente
            </Link>
          </section>
        ) : (
          <PaymentsAllocateSection
            accounts={scopedAccounts}
            walletBalanceLabel={formatMoney(
              core.wallet.balance,
              core.wallet.currency,
            )}
            walletBalance={core.wallet.balance}
            clienteName={clienteName}
          />
        )}
      </div>
    </PaymentsFundingModeProvider>
  );
}
