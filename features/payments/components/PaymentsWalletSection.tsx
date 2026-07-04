import { getPaymentPageCore } from "@/services/payments.service";
import type { SessionUser } from "@/types/auth";
import { WalletSummaryPremium } from "./WalletSummaryPremium";

interface PaymentsWalletSectionProps {
  session: SessionUser;
}

export async function PaymentsWalletSection({ session }: PaymentsWalletSectionProps) {
  const core = await getPaymentPageCore(session);
  const preferredGateway =
    core.gateways.find((g) => g.id === core.wallet.preferredGateway) ??
    core.gateways[0]!;

  return (
    <WalletSummaryPremium
      wallet={core.wallet}
      preferredGateway={preferredGateway}
    />
  );
}
