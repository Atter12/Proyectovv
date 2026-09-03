import { getPaymentPageCore } from "@/services/payments.service";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
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
  const actingAsCliente = await getActingAsCliente(session.id);
  const capabilities = withActAsClienteView(
    resolvePaymentsFundingCapabilities({
      email: session.email,
      role: session.role,
    }),
    actingAsCliente,
  );

  return (
    <WalletSummaryPremium
      wallet={core.wallet}
      preferredGateway={preferredGateway}
      staffMode={(staffMode && !actingAsCliente) || capabilities.isStaff}
      canClientStripeFund={capabilities.canClientStripeFund}
      hecomFinance={hecomFinance}
      clienteName={clienteName}
    />
  );
}
