import { formatMoney } from "@/lib/format-money";
import { WalletSummaryActions } from "./WalletSummaryActions.client";
import type { PaymentGateway, WalletOverview } from "@/types/payment";

interface WalletSummaryPremiumProps {
  wallet: WalletOverview;
  preferredGateway: PaymentGateway;
  /** Gerentes fondean por BM; la cartera Holistic es solo camino cliente. */
  staffMode?: boolean;
  /** Super admin / cliente: pueden abrir Stripe. Gerentes normales no. */
  canClientStripeFund?: boolean;
}

export function WalletSummaryPremium({
  wallet,
  preferredGateway,
  staffMode = false,
  canClientStripeFund = true,
}: WalletSummaryPremiumProps) {
  return (
    <div className="overflow-hidden rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0e9e0] text-[#6b5344]">
              <svg
                className="h-4 w-4"
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
              <p className="truncate text-[13px] font-medium text-[#1a1612]">
                {wallet.name}
              </p>
              <p className="text-[11px] text-[#7a736a]">
                {staffMode && !canClientStripeFund
                  ? "Modo gerente: fondeá desde BM (sin Stripe)"
                  : staffMode
                    ? "Super admin: Stripe o BM según el camino elegido"
                    : "Listo para asignar a cuentas TikTok"}
              </p>
            </div>
          </div>

          <p className="mt-3 text-[2rem] font-medium tracking-[-0.02em] tabular-nums text-[#1a1612] sm:text-[2.25rem]">
            {formatMoney(wallet.balance, wallet.currency)}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[#7a736a]">
            <span>
              Última recarga:{" "}
              <span className="text-[#5c564e]">
                {wallet.lastTopUp ?? "Sin registros"}
              </span>
            </span>
            <span>
              Método:{" "}
              <span className="text-[#5c564e]">{preferredGateway.name}</span>
            </span>
          </div>
        </div>

        {canClientStripeFund ? (
          <WalletSummaryActions
            availableBalance={wallet.balance}
            currency={wallet.currency}
          />
        ) : (
          <a
            href="#asignar-saldo"
            className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#e85a1c] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#d14e16] sm:w-auto"
          >
            Ir a fondear BM
          </a>
        )}
      </div>
    </div>
  );
}
