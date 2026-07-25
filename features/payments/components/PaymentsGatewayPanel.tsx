import { PaymentOverviewStats } from "./PaymentOverviewStats";
import { PaymentsGatewayBlockClient } from "./PaymentsGatewayBlock.client";
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
    <div className="space-y-6 lg:space-y-8">
      {/* Pay flow first — stats after so users don't scroll past KPIs to reach Stripe */}
      <PaymentsGatewayBlockClient
        gateways={core.gateways}
        initialSelected={core.selectedGateway}
      />

      <PaymentOverviewStats
        wallet={core.wallet}
        summary={core.summary}
        activeGateway={activeGateway}
      />
    </div>
  );
}
