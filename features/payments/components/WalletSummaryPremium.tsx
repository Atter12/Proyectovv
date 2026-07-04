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
      <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-[5rem] bg-gradient-to-br from-[#4056ff]/8 to-[#7c3aed]/5" />

      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4056ff]/10 text-[#4056ff]">
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
            <div>
              <p className="text-sm font-medium text-[#64748b]">{wallet.name}</p>
              <p className="text-xs text-slate-400">Saldo disponible</p>
            </div>
          </div>

          <p className="mt-5 text-4xl font-bold tracking-tight text-[#0f172a] sm:text-[2.75rem]">
            {formatMoney(wallet.balance, wallet.currency)}
          </p>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#64748b]">
            <span>
              Última recarga:{" "}
              <span className="font-medium text-[#0f172a]">
                {wallet.lastTopUp ?? "Sin registros"}
              </span>
            </span>
            <span>
              Método preferido:{" "}
              <span className="font-medium text-[#0f172a]">
                {preferredGateway.name}
              </span>
            </span>
          </div>
        </div>

        <WalletSummaryActions />
      </div>
    </Card>
  );
}
