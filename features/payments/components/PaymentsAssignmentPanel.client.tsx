"use client";

import { useMemo, useState } from "react";
import { filterPaymentAccounts } from "@/lib/filter/payment-accounts";
import { PaymentToolbar } from "./PaymentToolbar.client";
import { AllocateBalanceModal } from "./AllocateBalanceModal.client";
import { EditTikTokIdsModal } from "./EditTikTokIdsModal.client";
import { ReclaimBalanceModal } from "./ReclaimBalanceModal.client";
import { PaymentsTable } from "./PaymentsTable";
import type { PaymentAccountAllocation } from "@/types/payment";

interface PaymentsAssignmentPanelProps {
  accounts: PaymentAccountAllocation[];
  /** Explicit prop — avoid relying on context inside portaled modal. */
  agencyBmFunding?: boolean;
  allowForceLedger?: boolean;
}

export function PaymentsAssignmentPanel({
  accounts,
  agencyBmFunding = false,
  allowForceLedger = false,
}: PaymentsAssignmentPanelProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedAccount, setSelectedAccount] =
    useState<PaymentAccountAllocation | null>(null);
  const [reclaimAccount, setReclaimAccount] =
    useState<PaymentAccountAllocation | null>(null);
  const [editAccount, setEditAccount] =
    useState<PaymentAccountAllocation | null>(null);

  const filteredAccounts = useMemo(
    () => filterPaymentAccounts(accounts, { search, status }),
    [accounts, search, status],
  );

  return (
    <>
      <PaymentToolbar
        search={search}
        status={status}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
      />
      <PaymentsTable
        accounts={filteredAccounts}
        onAllocate={setSelectedAccount}
        onReclaim={setReclaimAccount}
        onEditTikTokIds={setEditAccount}
        agencyBmFunding={agencyBmFunding}
      />
      <AllocateBalanceModal
        account={selectedAccount}
        open={selectedAccount !== null}
        onClose={() => setSelectedAccount(null)}
        agencyBmFunding={agencyBmFunding}
      />
      <ReclaimBalanceModal
        account={reclaimAccount}
        open={reclaimAccount !== null}
        onClose={() => setReclaimAccount(null)}
        allowForceLedger={allowForceLedger}
      />
      <EditTikTokIdsModal
        account={editAccount}
        open={editAccount !== null}
        onClose={() => setEditAccount(null)}
      />
    </>
  );
}
