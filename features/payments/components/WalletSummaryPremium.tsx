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

/**
 * Cartera Holistic — fondo claro (nunca negro).
 */
export function WalletSummaryPremium({
  wallet,
  preferredGateway,
  staffMode = false,
  canClientStripeFund = true,
}: WalletSummaryPremiumProps) {
  const subtitle =
    staffMode && !canClientStripeFund
      ? "Modo gerente: fondeá desde BM (sin Stripe)"
      : staffMode
        ? "Super admin: Stripe o BM según el camino elegido"
        : "Listo para asignar a cuentas TikTok";

  return (
    <section className="overflow-hidden rounded-[1rem] border border-[#ece7e0] bg-white shadow-[0_12px_32px_-20px_rgb(28_25_23_/_0.18)]">
      {/* Acento superior naranja, sin banda oscura */}
      <div
        aria-hidden
        className="h-1 bg-[linear-gradient(90deg,#ff781f,#ffa12c,#ff781f)]"
      />

      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
            Cartera Holistic
          </p>
          <p className="mt-1 text-[13px] font-medium text-[#5c564e]">
            {subtitle}
          </p>
          <p className="mt-1 truncate text-[12px] text-[#8a8177]">
            {wallet.name}
          </p>
          <p className="mt-3 text-[2rem] font-bold leading-none tracking-[-0.04em] tabular-nums text-[#1c1917] sm:text-[2.35rem]">
            {formatMoney(wallet.balance, wallet.currency)}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#5c564e]">
            <span>
              Última recarga:{" "}
              <span className="font-semibold text-[#1c1917]">
                {wallet.lastTopUp ?? "Sin registros"}
              </span>
            </span>
            <span>
              Método:{" "}
              <span className="font-semibold text-[#1c1917]">
                {preferredGateway.name}
              </span>
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
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05] sm:w-auto"
          >
            Ir a fondear BM
          </a>
        )}
      </div>
    </section>
  );
}
