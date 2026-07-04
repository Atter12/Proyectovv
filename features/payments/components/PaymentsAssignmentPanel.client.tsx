"use client";

import { useMemo, useState } from "react";
import { filterPaymentAccounts } from "@/lib/filter/payment-accounts";
import { PaymentToolbar } from "./PaymentToolbar.client";
import { PaymentsTable } from "./PaymentsTable";
import type { PaymentAccountAllocation } from "@/types/payment";

interface PaymentsAssignmentPanelProps {
  accounts: PaymentAccountAllocation[];
}

export function PaymentsAssignmentPanel({
  accounts,
}: PaymentsAssignmentPanelProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

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
      <PaymentsTable accounts={filteredAccounts} />
    </>
  );
}
