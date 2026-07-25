import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format-money";
import { WalletSummaryActions } from "./WalletSummaryActions.client";
import type { PaymentGateway, WalletOverview } from "@/types/payment";

interface WalletSummaryPremiumProps {
  wallet: WalletOverview;
  preferredGateway: PaymentGateway;
}

export function WalletSummaryPremium({
  wallet,
  preferredGateway,
}: WalletSummaryPremiumProps) {
  return (
    <Card className="relative overflow-hidden p-0">
      <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-[5rem] bg-[var(--brand-primary)]/[0.08]" />

      <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-8 lg:gap-y-0 lg:p-8">
        <div className="flex min-w-0 items-center gap-3 lg:col-start-1 lg:row-start-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--admin-text-muted,#64748b)]">
              {wallet.name}
            </p>
            <p className="text-xs text-[var(--admin-text-soft,#94a3b8)]">
              Saldo disponible
            </p>
          </div>
        </div>

        {/* Mobile: right under title. Desktop: right column spanning rows */}
        <div className="w-full lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:w-auto">
          <WalletSummaryActions
            availableBalance={wallet.balance}
            currency={wallet.currency}
          />
        </div>

        <p className="font-display text-[2.35rem] font-medium tracking-[-0.03em] text-[var(--foreground)] sm:text-[2.75rem] lg:col-start-1 lg:row-start-2">
          {formatMoney(wallet.balance, wallet.currency)}
        </p>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--admin-text-muted,#64748b)] lg:col-start-1 lg:row-start-3">
          <span>
            Última recarga:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {wallet.lastTopUp ?? "Sin registros"}
            </span>
          </span>
          <span>
            Método preferido:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {preferredGateway.name}
            </span>
          </span>
        </div>
      </div>
    </Card>
  );
}
