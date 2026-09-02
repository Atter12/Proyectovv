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
  buildAdvertiserEnsureList,
  enrichAllocationAccountsFromAdsOverview,
} from "@/lib/payments/enrich-allocation-accounts";
import {
  sortPaymentAccounts,
  summarizePaymentAccounts,
} from "@/lib/sort/payment-accounts";
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
import type { AdAccount } from "@/types/ad-account";
import type { PaymentAccountAllocation } from "@/types/payment";
import Link from "next/link";
import { routes } from "@/config/routes";

interface PaymentsGatewayPanelProps {
  session: SessionUser;
  hecomAdvertiserIds?: string[];
  hecomClienteId?: string;
  clienteName?: string;
  hecomFinance?: HecomFinanceSnapshot | null;
  /** Cuentas ads del cliente (nombres TikTok + BM para Pagos). */
  adsAccounts?: AdAccount[];
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
  adsAccounts = [],
  skipOrphanCleanup = false,
  skipApprovedSync = false,
}: PaymentsGatewayPanelProps) {
  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  if (!skipOrphanCleanup && session.organizationId) {
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
  let suspendedIds: string[] = [];
  let syncNote: string | null = null;
  let ensured = 0;
  const advertiserEnsureList = (ids: string[]) =>
    buildAdvertiserEnsureList(ids, adsAccounts);

  if (
    !skipApprovedSync &&
    session.organizationId &&
    hecomClienteId
  ) {
    try {
      // Cache-first (también gerente BM): el forceRefresh en cada visita
      // duplicaba el pull completo de TikTok y frenaba Pagos al entrar.
      const sync = await syncApprovedAdAccountsForCliente({
        organizationId: session.organizationId,
        clienteId: hecomClienteId,
        userId: session.id,
        forceRefresh: false,
      });

      suspendedIds = [...(sync.suspendedAdvertiserIds ?? [])];

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
          "No se pudo consultar TikTok; si Hecom no tiene advertiser_id, no hay cuentas para recargar todavía.";
      } else {
        syncNote =
          "No se pudo consultar el estado en TikTok; se muestran las cuentas mapeadas en Hecom.";
      }

      // Asegurar filas en la org (aprobadas + suspendidas) → Recuperar + Recargar.
      const ensureIds = [
        ...new Set([
          ...approvedIds,
          ...suspendedIds,
          ...(adsAccounts ?? [])
            .filter((a) => a.status === "disabled")
            .map((a) => a.externalAccountId?.trim())
            .filter((id): id is string => Boolean(id)),
        ]),
      ];
      if (ensureIds.length > 0) {
        ensured = await ensureAdvertisersInOrganizationForAllocation({
          organizationId: session.organizationId,
          clienteId: hecomClienteId,
          clienteName,
          userId: session.id,
          advertisers: advertiserEnsureList(ensureIds).map((row) => ({
            ...row,
            status:
              suspendedIds.includes(row.advertiserId) ||
              row.status === "disabled"
                ? "disabled"
                : row.status,
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
        suspendedIds: suspendedIds.length,
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

  // Si el sync se saltó (vuelta Stripe), igual asegurá suspendidas del overview.
  if (
    skipApprovedSync &&
    session.organizationId &&
    hecomClienteId
  ) {
    const disabledEnsureIds = [
      ...new Set(
        (adsAccounts ?? [])
          .filter((a) => a.status === "disabled")
          .map((a) => a.externalAccountId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (disabledEnsureIds.length > 0) {
      await ensureAdvertisersInOrganizationForAllocation({
        organizationId: session.organizationId,
        clienteId: hecomClienteId,
        clienteName,
        userId: session.id,
        advertisers: advertiserEnsureList(disabledEnsureIds).map((row) => ({
          ...row,
          status: "disabled",
        })),
      });
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

  // Con cliente Hecom: leer con service role y scopear (evita pool vacío por RLS/viewer).
  let pool: PaymentAccountAllocation[] = core.adAccountsForAllocation;
  if (session.organizationId && hecomClienteId) {
    if (pool.length === 0 && approvedIds.length > 0) {
      ensured = await ensureAdvertisersInOrganizationForAllocation({
        organizationId: session.organizationId,
        clienteId: hecomClienteId,
        clienteName,
        userId: session.id,
        advertisers: advertiserEnsureList(approvedIds),
      });
    }

    const adminPool = await listOrganizationAdAccountsForAllocation(
      session.organizationId,
    );
    if (adminPool.length > 0) {
      pool = adminPool;
    }
  } else if (capabilities.canAgencyBmFund && session.organizationId) {
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

  // IDs del cliente: aprobadas + suspendidas (sync BM) + overview ads.
  const clienteAdvIds = [
    ...new Set(
      [
        ...(hecomAdvertiserIds ?? []),
        ...approvedIds,
        ...suspendedIds,
        ...(adsAccounts ?? [])
          .map((a) => a.externalAccountId?.trim())
          .filter((id): id is string => Boolean(id)),
      ].map((id) => id.trim()),
    ),
  ];

  const markSuspended = (
    accounts: PaymentAccountAllocation[],
  ): PaymentAccountAllocation[] =>
    enrichAllocationAccountsFromAdsOverview(accounts, adsAccounts).map(
      (account) => {
        const ext = account.externalAccountId?.trim();
        if (ext && suspendedIds.includes(ext)) {
          return { ...account, status: "disabled" };
        }
        return account;
      },
    );

  // Recargar: activas/pendientes Aprobadas.
  const fundableAccounts = markSuspended(
    hasClienteScope
      ? scopeAllocationAccountsToHecomAdvertisers(pool, approvedIds)
      : pool,
  ).filter((account) => account.status !== "disabled");

  // Suspendida CON saldo Holistic: se queda en la misma tabla con “Recuperar”.
  // Sin saldo → sale de Pagos (solo vive en Cuentas ads).
  const reclaimableInTable = markSuspended(
    hasClienteScope
      ? scopeAllocationAccountsToHecomAdvertisers(pool, clienteAdvIds)
      : pool,
  ).filter(
    (account) =>
      account.status === "disabled" && Number(account.balance) > 0,
  );

  const seenIds = new Set(fundableAccounts.map((a) => a.id));
  const scopedAccounts = sortPaymentAccounts([
    ...reclaimableInTable.filter((a) => {
      if (seenIds.has(a.id)) return false;
      seenIds.add(a.id);
      return true;
    }),
    ...fundableAccounts,
  ]);

  const allocationSummary = summarizePaymentAccounts(scopedAccounts);

  const scopedSummary = {
    ...core.summary,
    accountsReadyForAllocation: fundableAccounts.filter(
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
          allocationSummary={allocationSummary}
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
              Recargar cuenta ads · {clienteName ?? "Este cliente"}
            </p>
            <h2 className="mt-1.5 text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
              Sin cuentas para recargar acá
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
              Solo listamos cuentas Aprobadas y suspendidas que todavía tengan
              saldo Holistic por recuperar. Las baneadas en $0 estánieron de
              Pagos: miralas en{" "}
              <span className="font-semibold text-[var(--auth-text)]">
                Cuentas ads
              </span>
              .
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
            allowForceLedger={
              capabilities.isStaff || capabilities.isSuperAdmin
            }
          />
        )}
      </div>
    </PaymentsFundingModeProvider>
  );
}
