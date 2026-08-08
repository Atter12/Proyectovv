import { getPaymentPageCore } from "@/services/payments.service";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import type { SessionUser } from "@/types/auth";
import type { HecomFinanceSnapshot } from "@/features/payments/types/hecom-finance-snapshot";
import { WalletSummaryPremium } from "./WalletSummaryPremium";

interface PaymentsWalletSectionProps {
  session: SessionUser;
  staffMode?: boolean;
  hecomFinance?: HecomFinanceSnapshot | null;
  clienteName?: string;
}

export async function PaymentsWalletSection({
  session,
  staffMode = false,
  hecomFinance = null,
  clienteName,
}: PaymentsWalletSectionProps) {
  const core = await getPaymentPageCore(session);
  const preferredGateway =
    core.gateways.find((g) => g.id === core.wallet.preferredGateway) ??
    core.gateways[0]!;
  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  return (
    <WalletSummaryPremium
      wallet={core.wallet}
      preferredGateway={preferredGateway}
      staffMode={staffMode || capabilities.isStaff}
      canClientStripeFund={capabilities.canClientStripeFund}
      hecomFinance={hecomFinance}
      clienteName={clienteName}
    />
  );
}
