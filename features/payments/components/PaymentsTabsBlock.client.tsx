"use client";

import { useMemo, useState } from "react";
import { filterPaymentAccounts } from "@/lib/filter/payment-accounts";
import { PaymentsTabContent } from "./PaymentsTabContent";
import { PaymentsTabNav } from "./PaymentsTabNav.client";
import type { PaymentOverview, PaymentTabKey } from "@/types/payment";

interface PaymentsTabsBlockProps {
  data: PaymentOverview;
}

export function PaymentsTabsBlock({ data }: PaymentsTabsBlockProps) {
  const [tab, setTab] = useState<PaymentTabKey>("assignment");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const filteredAccounts = useMemo(
    () =>
      filterPaymentAccounts(data.adAccountsForAllocation, {
        search,
        status,
      }),
    [data.adAccountsForAllocation, search, status],
  );

  return (
    <>
      <PaymentsTabNav activeTab={tab} onTabChange={setTab} />
      <PaymentsTabContent
        data={data}
        tab={tab}
        filteredAccounts={filteredAccounts}
        search={search}
        status={status}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
      />
    </>
  );
}
