import { PaymentOverviewStats } from "./PaymentOverviewStats";
import { PaymentsAllocateSection } from "./PaymentsAllocateSection";
import { PaymentsGatewayBlockClient } from "./PaymentsGatewayBlock.client";
import { PaymentsFundingModeProvider } from "./PaymentsFundingModeContext.client";
import { formatMoney } from "@/lib/format-money";
import { scopeAllocationAccountsToHecomAdvertisers } from "@/lib/payments/scope-hecom-accounts";
import { getPaymentPageCore } from "@/services/payments.service";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";
import type { SessionUser } from "@/types/auth";
import Link from "next/link";
import { routes } from "@/config/routes";

interface PaymentsGatewayPanelProps {
  session: SessionUser;
  hecomAdvertiserIds?: string[];
  clienteName?: string;
}

export async function PaymentsGatewayPanel({
  session,
  hecomAdvertiserIds,
  clienteName,
}: PaymentsGatewayPanelProps) {
  const core = await getPaymentPageCore(session);
  const isStaff =
    isHecomOtpStaffEmail(session.email) ||
    session.role === "owner" ||
    session.role === "admin";
  const activeGateway =
    core.gateways.find((gateway) => gateway.id === core.selectedGateway) ??
    core.gateways[0]!;

  const scopedAccounts =
    hecomAdvertiserIds != null
      ? scopeAllocationAccountsToHecomAdvertisers(
          core.adAccountsForAllocation,
          hecomAdvertiserIds,
        )
      : core.adAccountsForAllocation;

  const scopedSummary = {
    ...core.summary,
    accountsReadyForAllocation: scopedAccounts.filter(
      (a) => a.status === "active" || a.status === "pending",
    ).length,
  };

  return (
    <PaymentsFundingModeProvider isStaff={isStaff}>
      <div className="space-y-5">
        <PaymentsGatewayBlockClient
          gateways={core.gateways}
          initialSelected={core.selectedGateway}
        />

        <PaymentOverviewStats
          wallet={core.wallet}
          summary={scopedSummary}
          activeGateway={activeGateway}
        />

        {hecomAdvertiserIds != null && scopedAccounts.length === 0 ? (
          <section
            id="asignar-saldo"
            className="rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] px-5 py-5 sm:px-6"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a5a38]">
              2 · Fondear cuenta ads · {clienteName ?? "Este cliente"}
            </p>
            <h2 className="mt-1 text-[15px] font-medium text-[#1a1612]">
              Sin cuentas Holistic para asignar
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
              {clienteName ?? "Este cliente"} tiene cuentas en Hecom, pero todavía
              no hay cuentas ads de Holistic vinculadas a esos advertiser IDs.
            </p>
            <Link
              href={routes.adAccounts}
              className="mt-3 inline-flex text-[13px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
            >
              Ver cuentas Hecom del cliente
            </Link>
          </section>
        ) : (
          <PaymentsAllocateSection
            accounts={scopedAccounts}
            walletBalanceLabel={formatMoney(
              core.wallet.balance,
              core.wallet.currency,
            )}
            walletBalance={core.wallet.balance}
            clienteName={clienteName}
          />
        )}
      </div>
    </PaymentsFundingModeProvider>
  );
}
