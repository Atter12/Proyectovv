import { PaymentOverviewStats } from "./PaymentOverviewStats";
import { PaymentsAllocateSection } from "./PaymentsAllocateSection";
import { PaymentsGatewayBlockClient } from "./PaymentsGatewayBlock.client";
import { PaymentsFundingModeProvider } from "./PaymentsFundingModeContext.client";
import { formatMoney } from "@/lib/format-money";
import { scopeAllocationAccountsToHecomAdvertisers } from "@/lib/payments/scope-hecom-accounts";
import { reverseOrphanedAgencyBmBridges } from "@/lib/payments/cleanup-orphaned-agency-bridges.server";
import { syncApprovedAdAccountsForCliente } from "@/lib/hecom/sync-approved-ad-accounts.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import {
  getPaymentPageCore,
  listOrganizationAdAccountsForAllocation,
} from "@/services/payments.service";
import type { SessionUser } from "@/types/auth";
import type { PaymentAccountAllocation } from "@/types/payment";
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

/**
 * Pagos / Asignar — mismo resultado para gerente y super admin en el mismo cliente.
 * 1) Sync BM (aprobadas) → upsert en org del usuario
 * 2) Lista ad_accounts vía service role (no depende de quirks de RLS/viewer)
 * 3) Scope a advertisers del cliente operativo
 */
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

  let approvedIds = [...(hecomAdvertiserIds ?? [])];
  let syncNote: string | null = null;

  if (
    !skipApprovedSync &&
    session.organizationId &&
    hecomClienteId
  ) {
    try {
      // Gerentes sin mapeo Hecom: force BM match + upsert en SU org.
      const forceRefresh =
        capabilities.canAgencyBmFund && (hecomAdvertiserIds?.length ?? 0) === 0;

      const sync = await syncApprovedAdAccountsForCliente({
        organizationId: session.organizationId,
        clienteId: hecomClienteId,
        userId: session.id,
        forceRefresh,
      });

      if (!sync.skippedUnavailableStatus) {
        if (sync.approvedAdvertiserIds.length > 0) {
          approvedIds = sync.approvedAdvertiserIds;
        }
        if (sync.approvedAdvertiserIds.length === 0) {
          syncNote =
            "No hay cuentas TikTok Aprobadas para este cliente (BM + Hecom). Revisá el advertiser o el nombre en el Business Center.";
        }
      } else if (approvedIds.length === 0) {
        syncNote =
          "No se pudo consultar TikTok; si Hecom no tiene advertiser_id, no hay cuentas para fondear todavía.";
      } else {
        syncNote =
          "No se pudo consultar el estado en TikTok; se muestran las cuentas mapeadas en Hecom.";
      }

      console.info("[payments] allocate_scope", {
        email: session.email,
        isStaff: capabilities.isStaff,
        isSuperAdmin: capabilities.isSuperAdmin,
        org: session.organizationId,
        clienteId: hecomClienteId,
        hecomIds: hecomAdvertiserIds?.length ?? 0,
        approvedIds: approvedIds.length,
        upserted: sync.upserted,
        skipped: sync.skippedUnavailableStatus,
      });
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

  // Staff/gerente: leer con service role para no quedar en 0 por org RLS/viewer.
  let pool: PaymentAccountAllocation[] = core.adAccountsForAllocation;
  if (capabilities.canAgencyBmFund && session.organizationId) {
    const adminPool = await listOrganizationAdAccountsForAllocation(
      session.organizationId,
    );
    if (adminPool.length > 0) {
      pool = adminPool;
    }
  }

  const hasClienteScope = hecomAdvertiserIds != null || Boolean(hecomClienteId);

  const scopedAccounts = hasClienteScope
    ? scopeAllocationAccountsToHecomAdvertisers(pool, approvedIds).filter(
        (account) => account.status !== "disabled",
      )
    : pool.filter((account) => account.status !== "disabled");

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

        {hasClienteScope && scopedAccounts.length === 0 ? (
          <section
            id="asignar-saldo"
            className="dashboard-surface-card rounded-[1rem] px-5 py-5 sm:px-6 sm:py-6"
          >
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
              Fondear cuenta ads · {clienteName ?? "Este cliente"}
            </p>
            <h2 className="mt-1.5 text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
              Sin cuentas Aprobadas para asignar
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
              Solo listamos advertisers en estado{" "}
              <span className="font-semibold text-[var(--auth-text)]">
                Aprobado
              </span>{" "}
              en TikTok. Si {clienteName ?? "este cliente"} tiene cuentas
              suspendidas, no aparecen acá. Probá recargar o mapear el
              advertiser_id en Hecom.
            </p>
            <Link
              href={routes.adAccounts}
              className="mt-4 inline-flex h-10 items-center rounded-lg bg-[var(--auth-accent)] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
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
