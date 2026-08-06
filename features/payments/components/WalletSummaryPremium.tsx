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
    <section className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.07)] bg-[#0f0e0c] text-white shadow-[0_18px_40px_rgb(15_14_12_/_0.18)]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ff9a4a]">
          Cartera Holistic
        </p>
        <p className="mt-1 text-[14px] font-medium text-white/70">
          {staffMode && !canClientStripeFund
            ? "Modo gerente: fondeá desde BM (sin Stripe)"
            : staffMode
              ? "Super admin: Stripe o BM según el camino elegido"
              : "Listo para asignar a cuentas TikTok"}
        </p>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:py-6">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-white/55">
            {wallet.name}
          </p>
          <p className="mt-2 font-display text-[2.15rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-white sm:text-[2.5rem]">
            {formatMoney(wallet.balance, wallet.currency)}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-white/45">
            <span>
              Última recarga:{" "}
              <span className="text-white/75">
                {wallet.lastTopUp ?? "Sin registros"}
              </span>
            </span>
            <span>
              Método:{" "}
              <span className="text-white/75">{preferredGateway.name}</span>
            </span>
          </div>
        </div>

        {canClientStripeFund ? (
          <WalletSummaryActions
            availableBalance={wallet.balance}
            currency={wallet.currency}
            tone="dark"
          />
        ) : (
          <a
            href="#asignar-saldo"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.35)] transition-[filter] hover:brightness-[1.05] sm:w-auto"
          >
            Ir a fondear BM
          </a>
        )}
      </div>
    </section>
  );
}
