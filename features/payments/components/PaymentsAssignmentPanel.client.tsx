"use client";

import { useMemo, useState } from "react";
import { filterPaymentAccounts } from "@/lib/filter/payment-accounts";
import {
  sortPaymentAccounts,
  summarizePaymentAccounts,
  type PaymentAccountSortKey,
} from "@/lib/sort/payment-accounts";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
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
  const { metricsByAdvertiser, loading, lastUpdatedAt, refreshAfterFundingChange } =
    useAdAccountLiveMetrics(true);

  const accountSummary = useMemo(
    () => summarizePaymentAccounts(accounts),
    [accounts],
  );

  const liveCreditTotalUsd = useMemo(() => {
    if (!agencyBmFunding) return null;
    let total = 0;
    let hasAny = false;
    for (const account of accounts) {
      const id = account.externalAccountId?.trim();
      if (!id) continue;
      const metric = metricsByAdvertiser[id];
      if (metric?.balanceUsd != null) {
        total += metric.balanceUsd;
        hasAny = true;
      }
    }
    return hasAny ? total : null;
  }, [accounts, agencyBmFunding, metricsByAdvertiser]);

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
          liveMetricsLoading={loading}
          lastUpdatedAt={lastUpdatedAt}
        />
      ) : null}

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
      />
      <EditTikTokIdsModal
        account={editAccount}
        open={editAccount !== null}
        onClose={() => setEditAccount(null)}
      />
    </>
  );
}
