import { PaymentOverviewStats } from "./PaymentOverviewStats";
import { PaymentsAllocateSection } from "./PaymentsAllocateSection";
import { PaymentsGatewayBlockClient } from "./PaymentsGatewayBlock.client";
import { formatMoney } from "@/lib/format-money";
import { getPaymentPageCore } from "@/services/payments.service";
import type { SessionUser } from "@/types/auth";

interface PaymentsGatewayPanelProps {
  session: SessionUser;
}

export async function PaymentsGatewayPanel({ session }: PaymentsGatewayPanelProps) {
  const core = await getPaymentPageCore(session);
  const activeGateway =
    core.gateways.find((gateway) => gateway.id === core.selectedGateway) ??
    core.gateways[0]!;

  return (
    <div className="space-y-5">
      <PaymentsGatewayBlockClient
        gateways={core.gateways}
        initialSelected={core.selectedGateway}
      />

      <PaymentOverviewStats
        wallet={core.wallet}
        summary={core.summary}
        activeGateway={activeGateway}
      />

      <PaymentsAllocateSection
        accounts={core.adAccountsForAllocation}
        walletBalanceLabel={formatMoney(core.wallet.balance, core.wallet.currency)}
      />
    </div>
  );
}
