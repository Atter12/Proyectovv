import { PaymentOverviewStats } from "./PaymentOverviewStats";
import { PaymentsAllocateSection } from "./PaymentsAllocateSection";
import { PaymentsGatewayBlockClient } from "./PaymentsGatewayBlock.client";
import { PaymentsFundingModeProvider } from "./PaymentsFundingModeContext.client";
import { formatMoney } from "@/lib/format-money";
import { scopeAllocationAccountsToHecomAdvertisers } from "@/lib/payments/scope-hecom-accounts";
import { reverseOrphanedAgencyBmBridges } from "@/lib/payments/cleanup-orphaned-agency-bridges.server";
import { syncApprovedAdAccountsForCliente } from "@/lib/hecom/sync-approved-ad-accounts.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import { DEFAULT_DEPOSIT_FEE_PERCENT } from "@/lib/payments/deposit-fee";
import { resolveFeePercentFromHecomCliente } from "@/lib/payments/resolve-hecom-deposit-fee.server";
import {
  ensureAdvertisersInOrganizationForAllocation,
  getPaymentPageCore,
  listOrganizationAdAccountsForAllocation,
} from "@/services/payments.service";
import type { HecomFinanceSnapshot } from "@/features/payments/types/hecom-finance-snapshot";
import type { SessionUser } from "@/types/auth";
import type { PaymentAccountAllocation } from "@/types/payment";
import Link from "next/link";
import { routes } from "@/config/routes";

interface PaymentsGatewayPanelProps {
  session: SessionUser;
  hecomAdvertiserIds?: string[];
  hecomClienteId?: string;
  clienteName?: string;
  hecomFinance?: HecomFinanceSnapshot | null;
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
  hecomFinance = null,
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
  let ensured = 0;

  if (
    !skipApprovedSync &&
    session.organizationId &&
    hecomClienteId
  ) {
    try {
      // Gerente BM: siempre live BM + upsert en SU org (no la del super admin).
      const forceRefresh = capabilities.canAgencyBmFund;

      const sync = await syncApprovedAdAccountsForCliente({
        organizationId: session.organizationId,
        clienteId: hecomClienteId,
        userId: session.id,
        forceRefresh,
      });

      if (!sync.skippedUnavailableStatus) {
        if (sync.approvedAdvertiserIds.length > 0) {
          approvedIds = [
            ...new Set([...approvedIds, ...sync.approvedAdvertiserIds]),
          ];
        }
        if (sync.approvedAdvertiserIds.length === 0 && approvedIds.length === 0) {
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

      // Si el SA ya fondeó en otra org, copiá filas a la org del gerente.
      if (capabilities.canAgencyBmFund && approvedIds.length > 0) {
        ensured = await ensureAdvertisersInOrganizationForAllocation({
          organizationId: session.organizationId,
          clienteId: hecomClienteId,
          clienteName,
          userId: session.id,
          advertisers: approvedIds.map((advertiserId) => ({
            advertiserId,
            name: clienteName ? `${clienteName} · TikTok` : null,
          })),
        });
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
        ensured,
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

  let depositFeePercent = DEFAULT_DEPOSIT_FEE_PERCENT;
  if (hecomClienteId) {
    try {
      const hecomCliente = await getHecomCliente(hecomClienteId);
      depositFeePercent = resolveFeePercentFromHecomCliente({
        tiktokDefaultFee: hecomCliente?.tiktokDefaultFee ?? null,
        accountFees: (hecomCliente?.tiktokAccounts ?? []).map((a) => a.fee),
      }).feePercent;
    } catch (error) {
      console.warn("[payments] deposit_fee_resolve_failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  // Staff/gerente: leer con service role para no quedar en 0 por org RLS/viewer.
  let pool: PaymentAccountAllocation[] = core.adAccountsForAllocation;
  if (capabilities.canAgencyBmFund && session.organizationId) {
    // Re-ensure if overview tenía IDs pero sync falló (org del gerente vacía).
    if (
      pool.length === 0 &&
      approvedIds.length > 0 &&
      hecomClienteId
    ) {
      ensured = await ensureAdvertisersInOrganizationForAllocation({
        organizationId: session.organizationId,
        clienteId: hecomClienteId,
        clienteName,
        userId: session.id,
        advertisers: approvedIds.map((advertiserId) => ({
          advertiserId,
          name: clienteName ? `${clienteName} · TikTok` : null,
        })),
      });
    }

    const adminPool = await listOrganizationAdAccountsForAllocation(
      session.organizationId,
    );
    if (adminPool.length > 0) {
      pool = adminPool;
    }
  }

  // Fallback: si en la org del super admin (u otra) hay filas con el mismo
  // hecom_cliente_id en metadata, tomar sus external ids y crearlas acá.
  if (
    capabilities.canAgencyBmFund &&
    session.organizationId &&
    hecomClienteId &&
    approvedIds.length === 0
  ) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data: metaRows } = await admin
        .from("ad_accounts")
        .select("external_account_id, name, metadata")
        .eq("platform", "tiktok")
        .filter("metadata->>hecom_cliente_id", "eq", hecomClienteId)
        .not("external_account_id", "is", null)
        .limit(50);

      const fromMeta = (metaRows ?? [])
        .map((row) => ({
          advertiserId: String(
            (row as { external_account_id?: string }).external_account_id ?? "",
          ).trim(),
          name: String((row as { name?: string }).name ?? "").trim() || null,
        }))
        .filter((row) => row.advertiserId);

      if (fromMeta.length > 0) {
        approvedIds = [...new Set(fromMeta.map((r) => r.advertiserId))];
        ensured = await ensureAdvertisersInOrganizationForAllocation({
          organizationId: session.organizationId,
          clienteId: hecomClienteId,
          clienteName,
          userId: session.id,
          advertisers: fromMeta,
        });
        const adminPool = await listOrganizationAdAccountsForAllocation(
          session.organizationId,
        );
        if (adminPool.length > 0) pool = adminPool;
        syncNote = null;
        console.info("[payments] allocate_from_meta_mirror", {
          email: session.email,
          clienteId: hecomClienteId,
          approvedIds: approvedIds.length,
          ensured,
        });
      }
    } catch (error) {
      console.warn("[payments] meta_mirror_skip", {
        error: error instanceof Error ? error.message : "unknown",
      });
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
          depositFeePercent={depositFeePercent}
        />

        <PaymentOverviewStats
          wallet={core.wallet}
          summary={scopedSummary}
          activeGateway={activeGateway}
          isStaff={capabilities.isStaff}
          hecomFinance={hecomFinance}
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
