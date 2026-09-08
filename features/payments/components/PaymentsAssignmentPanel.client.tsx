"use client";

import { useMemo, useState } from "react";
import { filterPaymentAccounts } from "@/lib/filter/payment-accounts";
import {
  sortPaymentAccounts,
  summarizePaymentAccounts,
  type PaymentAccountSortKey,
} from "@/lib/sort/payment-accounts";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { isTikTokBudgetCupoBalance } from "@/features/ad-accounts/lib/classify-tiktok-live-balance";
import { formatMoney } from "@/lib/format-money";
import { PaymentToolbar } from "./PaymentToolbar.client";
import { AllocateBalanceModal } from "./AllocateBalanceModal.client";
import { EditTikTokIdsModal } from "./EditTikTokIdsModal.client";
import { ReclaimBalanceModal } from "./ReclaimBalanceModal.client";
import { TransferBalanceModal } from "./TransferBalanceModal.client";
import { PaymentsGerenteAccountsSummary } from "./PaymentsGerenteAccountsSummary.client";
import { PaymentsTable } from "./PaymentsTable";
import type { PaymentAccountAllocation } from "@/types/payment";

interface PaymentsAssignmentPanelProps {
  accounts: PaymentAccountAllocation[];
  /** Explicit prop — avoid relying on context inside portaled modal. */
  agencyBmFunding?: boolean;
  allowForceLedger?: boolean;
  /** Cartera Holistic disponible para Asignar (modo cliente). */
  walletBalance?: number;
}

export function PaymentsAssignmentPanel({
  accounts,
  agencyBmFunding = false,
  allowForceLedger = false,
  walletBalance = 0,
}: PaymentsAssignmentPanelProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<PaymentAccountSortKey>("recommended");
  const [selectedAccount, setSelectedAccount] =
    useState<PaymentAccountAllocation | null>(null);
  const [reclaimAccount, setReclaimAccount] =
    useState<PaymentAccountAllocation | null>(null);
  const [transferAccount, setTransferAccount] =
    useState<PaymentAccountAllocation | null>(null);
  const [editAccount, setEditAccount] =
    useState<PaymentAccountAllocation | null>(null);

  // Siempre: el Saldo de la tabla debe alinearse con TikTok Manager (cupo
  // gastable), no solo con el ledger Holistic. Antes solo se pedía en modo gerente.
  const {
    metricsByAdvertiser,
    loading,
    lastUpdatedAt,
    error: liveMetricsError,
    refreshAfterFundingChange,
  } = useAdAccountLiveMetrics(true);

  const accountSummary = useMemo(
    () => summarizePaymentAccounts(accounts),
    [accounts],
  );

  const liveTikTokSummary = useMemo(() => {
    let cash = 0;
    let cupo = 0;
    let cashCount = 0;
    let cupoCount = 0;
    let stale = false;
    const advertiserIds = Array.from(
      new Set(
        accounts
          .map((account) => account.externalAccountId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    );

    for (const id of advertiserIds) {
      const metric = metricsByAdvertiser[id];
      if (metric?.balanceUsd == null) continue;
      stale ||= Boolean(metric.stale);
      if (isTikTokBudgetCupoBalance(metric)) {
        cupo += metric.balanceUsd;
        cupoCount += 1;
      } else {
        cash += metric.balanceUsd;
        cashCount += 1;
      }
    }

    return {
      cash: cashCount > 0 ? Math.round(cash * 100) / 100 : null,
      cupo: cupoCount > 0 ? Math.round(cupo * 100) / 100 : null,
      cashCount,
      cupoCount,
      expectedCount: advertiserIds.length,
      stale,
    };
  }, [accounts, metricsByAdvertiser]);

  const liveCreditTotalUsd =
    liveTikTokSummary.cash != null || liveTikTokSummary.cupo != null
      ? (liveTikTokSummary.cash ?? 0) + (liveTikTokSummary.cupo ?? 0)
      : null;

  const filteredAccounts = useMemo(() => {
    const filtered = filterPaymentAccounts(accounts, { search, status });
    return sortPaymentAccounts(filtered, sort);
  }, [accounts, search, status, sort]);

  return (
    <>
      {agencyBmFunding ? (
        <PaymentsGerenteAccountsSummary
          summary={accountSummary}
          liveCreditTotalUsd={liveCreditTotalUsd}
          liveCashTotalUsd={liveTikTokSummary.cash}
          liveCupoTotalUsd={liveTikTokSummary.cupo}
          liveMetricsLoading={loading}
          lastUpdatedAt={lastUpdatedAt}
        />
      ) : (
        <ClientBalanceComparison
          walletBalance={walletBalance}
          cashTotalUsd={liveTikTokSummary.cash}
          cupoTotalUsd={liveTikTokSummary.cupo}
          cashCount={liveTikTokSummary.cashCount}
          cupoCount={liveTikTokSummary.cupoCount}
          expectedCount={liveTikTokSummary.expectedCount}
          stale={liveTikTokSummary.stale}
          loading={loading}
          error={liveMetricsError}
        />
      )}

      <PaymentToolbar
        search={search}
        status={status}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        sort={sort}
        onSortChange={setSort}
        agencyBmFunding={agencyBmFunding}
      />
      <PaymentsTable
        accounts={filteredAccounts}
        onAllocate={setSelectedAccount}
        onReclaim={setReclaimAccount}
        onTransfer={setTransferAccount}
        onEditTikTokIds={setEditAccount}
        agencyBmFunding={agencyBmFunding}
        clientSelfService={!agencyBmFunding}
        liveMetricsByAdvertiser={metricsByAdvertiser}
        liveMetricsLoading={loading}
      />
      <AllocateBalanceModal
        account={selectedAccount}
        open={selectedAccount !== null}
        onClose={() => setSelectedAccount(null)}
        agencyBmFunding={agencyBmFunding}
        onFundingChanged={refreshAfterFundingChange}
        walletBalance={walletBalance}
      />
      <ReclaimBalanceModal
        account={reclaimAccount}
        open={reclaimAccount !== null}
        onClose={() => setReclaimAccount(null)}
        allowForceLedger={allowForceLedger}
        onFundingChanged={refreshAfterFundingChange}
      />
      <TransferBalanceModal
        sourceAccount={transferAccount}
        allAccounts={accounts}
        open={transferAccount !== null}
        onClose={() => setTransferAccount(null)}
        agencyBmFunding={agencyBmFunding}
        allowForceLedger={allowForceLedger}
        clientSelfService={!agencyBmFunding}
        onFundingChanged={refreshAfterFundingChange}
        liveMetricsByAdvertiser={metricsByAdvertiser}
      />
      <EditTikTokIdsModal
        account={editAccount}
        open={editAccount !== null}
        onClose={() => setEditAccount(null)}
      />
    </>
  );
}

function ClientBalanceComparison({
  walletBalance,
  cashTotalUsd,
  cupoTotalUsd,
  cashCount,
  cupoCount,
  expectedCount,
  stale,
  loading,
  error,
}: {
  walletBalance: number;
  cashTotalUsd: number | null;
  cupoTotalUsd: number | null;
  cashCount: number;
  cupoCount: number;
  expectedCount: number;
  stale: boolean;
  loading: boolean;
  error: string | null;
}) {
  const accountsWithData = cashCount + cupoCount;
  const partial = accountsWithData > 0 && accountsWithData < expectedCount;

  const tiktokValue =
    loading && cashTotalUsd == null
      ? "Actualizando…"
      : cashTotalUsd != null
        ? formatMoney(cashTotalUsd)
        : error
          ? "No disponible"
          : cupoTotalUsd != null
            ? "$0"
            : "Sin datos";

  const tiktokHint = (() => {
    if (cashTotalUsd != null) {
      const coverage = partial
        ? `Suma parcial: ${accountsWithData} de ${expectedCount} cuentas con datos`
        : `Suma en vivo de ${cashCount} ${cashCount === 1 ? "cuenta" : "cuentas"}`;
      const notes = [
        coverage,
        cupoTotalUsd != null ? "No incluye cupo publicitario" : null,
        stale || error ? "Incluye el último valor disponible" : null,
      ];
      return notes.filter(Boolean).join(" · ");
    }

    if (loading) return "Consultando TikTok Manager";
    if (error) return "No se pudo consultar TikTok Manager";
    if (cupoTotalUsd != null) {
      return `Cupo publicitario: ${formatMoney(cupoTotalUsd)} (no es saldo)`;
    }
    if (expectedCount === 0) return "No hay cuentas vinculadas a TikTok";
    return "TikTok no devolvió saldos para estas cuentas";
  })();

  return (
    <div
      className="border-b border-[var(--auth-border)] bg-[#faf8f5] px-4 py-3 sm:px-5"
      aria-label="Comparación de saldos"
      aria-busy={loading}
    >
      <div className="grid grid-cols-2 divide-x divide-[var(--auth-divider)] overflow-hidden rounded-xl border border-[var(--auth-divider)] bg-white">
        <BalanceValue
          label="Cartera Holistic"
          value={formatMoney(walletBalance)}
          hint="Disponible para asignar"
        />
        <BalanceValue
          label="Saldo TikTok"
          value={tiktokValue}
          hint={tiktokHint}
          live
        />
      </div>
    </div>
  );
}

function BalanceValue({
  label,
  value,
  hint,
  live = false,
}: {
  label: string;
  value: string;
  hint: string;
  live?: boolean;
}) {
  return (
    <div className="min-w-0 px-3.5 py-3 sm:px-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a8178]">
        {label}
      </p>
      <p
        className="mt-0.5 truncate text-[17px] font-semibold tabular-nums tracking-[-0.025em] text-[var(--auth-text)]"
        aria-live={live ? "polite" : undefined}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] leading-4 text-[var(--auth-text-muted)]">
        {hint}
      </p>
    </div>
  );
}
