import { Card } from "@/components/ui/Card";
import { PaymentOverviewStats } from "@/features/payments/components/PaymentOverviewStats";
import { PaymentsAddBalanceModalHost } from "@/features/payments/components/PaymentsAddBalanceModalHost.client";
import { PaymentsGatewaySection } from "@/features/payments/components/PaymentsGatewaySection.client";
import { PaymentsPageHeader } from "@/features/payments/components/PaymentsPageHeader";
import { PaymentsTabContent } from "@/features/payments/components/PaymentsTabContent";
import { PaymentsTabNav } from "@/features/payments/components/PaymentsTabNav.client";
import { WalletSummaryPremium } from "@/features/payments/components/WalletSummaryPremium.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { filterPaymentAccounts } from "@/lib/filter/payment-accounts";
import { getSearchParam } from "@/lib/search-params";
import { getPaymentOverview } from "@/services/payments.mock.service";
import type { PaymentGatewayId, PaymentTabKey } from "@/types/payment";
import { Suspense } from "react";

const VALID_TABS: PaymentTabKey[] = [
  "assignment",
  "account-tx",
  "wallet-tx",
  "refunds",
];

interface PaymentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  await requirePermission("payments:read");
  const params = await searchParams;
  const data = await getPaymentOverview();

  const tabParam = getSearchParam(params, "tab", "assignment");
  const tab: PaymentTabKey = VALID_TABS.includes(tabParam as PaymentTabKey)
    ? (tabParam as PaymentTabKey)
    : "assignment";

  const search = getSearchParam(params, "q");
  const status = getSearchParam(params, "status", "all");

  const gatewayParam = getSearchParam(params, "gateway");
  const selectedGateway: PaymentGatewayId =
    data.gateways.some((g) => g.id === gatewayParam)
      ? (gatewayParam as PaymentGatewayId)
      : data.selectedGateway;

  const activeGateway =
    data.gateways.find((g) => g.id === selectedGateway) ?? data.gateways[0];

  const preferredGateway =
    data.gateways.find((g) => g.id === data.wallet.preferredGateway) ??
    data.gateways[0];

  const filteredAccounts = filterPaymentAccounts(data.adAccountsForAllocation, {
    search,
    status,
  });

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6 lg:space-y-8">
      <PaymentsPageHeader data={data} />

      <div className="space-y-6 lg:space-y-8">
        <WalletSummaryPremium
          wallet={data.wallet}
          preferredGateway={preferredGateway}
        />

        <PaymentOverviewStats
          wallet={data.wallet}
          summary={data.summary}
          activeGateway={activeGateway}
        />

        <Suspense fallback={null}>
          <PaymentsGatewaySection
            gateways={data.gateways}
            selected={selectedGateway}
            defaultGateway={data.selectedGateway}
          />
        </Suspense>

        <Card padding="none" className="min-w-0 overflow-hidden">
          <Suspense fallback={null}>
            <PaymentsTabNav activeTab={tab} />
          </Suspense>
          <PaymentsTabContent
            data={data}
            tab={tab}
            filteredAccounts={filteredAccounts}
            initialSearch={search}
            initialStatus={status}
          />
        </Card>

        <PaymentsAddBalanceModalHost selectedGateway={selectedGateway} />
      </div>
    </div>
  );
}
