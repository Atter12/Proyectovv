"use client";

import { useMemo, useState } from "react";
import { filterPaymentAccounts } from "@/lib/filter/payment-accounts";
import { PaymentToolbar } from "./PaymentToolbar.client";
import { AllocateBalanceModal } from "./AllocateBalanceModal.client";
import { EditTikTokIdsModal } from "./EditTikTokIdsModal.client";
import { PaymentsBm200AllocateBanner } from "./PaymentsBm200AllocateBanner.client";
import { PaymentsTable } from "./PaymentsTable";
import type { PaymentAccountAllocation } from "@/types/payment";

interface PaymentsAssignmentPanelProps {
  accounts: PaymentAccountAllocation[];
  /** Explicit prop — avoid relying on context inside portaled modal. */
  agencyBmFunding?: boolean;
}

export function PaymentsAssignmentPanel({
  accounts,
  agencyBmFunding = false,
}: PaymentsAssignmentPanelProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedAccount, setSelectedAccount] =
    useState<PaymentAccountAllocation | null>(null);
  const [editAccount, setEditAccount] =
    useState<PaymentAccountAllocation | null>(null);

  const filteredAccounts = useMemo(
    () => filterPaymentAccounts(accounts, { search, status }),
    [accounts, search, status],
  );

  return (
    <>
      <PaymentsBm200AllocateBanner accounts={accounts} />
      <PaymentToolbar
        search={search}
        status={status}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
      />
      <PaymentsTable
        accounts={filteredAccounts}
        onAllocate={setSelectedAccount}
        onEditTikTokIds={setEditAccount}
        agencyBmFunding={agencyBmFunding}
      />
      <AllocateBalanceModal
        account={selectedAccount}
        open={selectedAccount !== null}
        onClose={() => setSelectedAccount(null)}
        agencyBmFunding={agencyBmFunding}
      />
      <EditTikTokIdsModal
        account={editAccount}
        open={editAccount !== null}
        onClose={() => setEditAccount(null)}
      />
    </>
  );
}
