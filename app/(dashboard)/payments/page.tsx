import { Card } from "@/components/ui/Card";
import { PaymentsGatewayBlock } from "@/features/payments/components/PaymentsGatewayBlock.client";
import { PaymentsPageHeader } from "@/features/payments/components/PaymentsPageHeader";
import { PaymentsTabsBlock } from "@/features/payments/components/PaymentsTabsBlock.client";
import { WalletSummaryPremium } from "@/features/payments/components/WalletSummaryPremium.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { getPaymentOverview } from "@/services/payments.service";

export default async function PaymentsPage() {
  const session = await requirePermission("payments:read");
  const data = await getPaymentOverview(session);

  const preferredGateway =
    data.gateways.find((g) => g.id === data.wallet.preferredGateway) ??
    data.gateways[0];

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6 lg:space-y-8">
      <PaymentsPageHeader data={data} />

      <div className="space-y-6 lg:space-y-8">
        <WalletSummaryPremium
          wallet={data.wallet}
          preferredGateway={preferredGateway}
        />

        <PaymentsGatewayBlock
          gateways={data.gateways}
          initialSelected={data.selectedGateway}
          wallet={data.wallet}
          summary={data.summary}
        />

        <Card padding="none" className="min-w-0 overflow-hidden">
          <PaymentsTabsBlock data={data} />
        </Card>
      </div>
    </div>
  );
}
