import { getTranslations } from "next-intl/server";
import { getAppFormatter } from "@/lib/i18n/get-app-formatter";
import { WalletSummaryActions } from "./WalletSummaryActions.client";
import type { HecomFinanceSnapshot } from "@/features/payments/types/hecom-finance-snapshot";
import type { PaymentGateway, WalletOverview } from "@/types/payment";

interface WalletSummaryPremiumProps {
  wallet: WalletOverview;
  preferredGateway: PaymentGateway;
  /** Gerentes fondean por BM; la cartera Holistic es solo camino cliente. */
  staffMode?: boolean;
  /** Super admin / cliente: pueden abrir Stripe. Gerentes normales no. */
  canClientStripeFund?: boolean;
  /** Saldo CRM del cliente operativo (gerente = bloque principal). */
  hecomFinance?: HecomFinanceSnapshot | null;
  clienteName?: string;
}

/**
 * Siempre muestra Cartera Holistic (disponible para asignar).
 * Gerente BM: CTA a recarga BM; Hecom queda como dato secundario.
 */
export async function WalletSummaryPremium({
  wallet,
  preferredGateway,
  staffMode = false,
  canClientStripeFund = true,
  hecomFinance = null,
  clienteName,
}: WalletSummaryPremiumProps) {
  const t = await getTranslations("payments");
  const { formatMoney } = await getAppFormatter();

  const debt =
    hecomFinance != null && hecomFinance.saldoEstimado < 0;

  const subtitle =
    staffMode && !canClientStripeFund
      ? t("walletCard.subtitleManager")
      : staffMode
        ? t("walletCard.subtitleStaff")
        : t("walletCard.subtitleClient");

  return (
    <section className="overflow-hidden rounded-[1rem] border border-[#ece7e0] bg-white shadow-[0_12px_32px_-20px_rgb(28_25_23_/_0.18)]">
      <div
        aria-hidden
        className="h-1 bg-[linear-gradient(90deg,#ff781f,#ffa12c,#ff781f)]"
      />

      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
            {t("walletCard.eyebrow")}
          </p>
          <p className="mt-1 text-[13px] font-medium text-[#5c564e]">
            {subtitle}
          </p>
          {clienteName ? (
            <p className="mt-1 text-[12px] text-[#8a8177]">{clienteName}</p>
          ) : (
            <p className="mt-1 truncate text-[12px] text-[#8a8177]">
              {wallet.name}
            </p>
          )}
          <p className="mt-3 text-[2rem] font-bold leading-none tracking-[-0.04em] tabular-nums text-[#1c1917] sm:text-[2.35rem]">
            {formatMoney(wallet.balance, wallet.currency)}
          </p>
          <p className="mt-1.5 text-[12px] font-medium text-[#5c564e]">
            {t("walletCard.availableHint")}
          </p>
          {hecomFinance != null && staffMode ? (
            <p className="mt-2 text-[12px] text-[#8a8177]">
              {t("walletCard.hecomLine", {
                label: debt
                  ? t("walletCard.hecomDebt")
                  : t("walletCard.hecomBalance"),
                saldo: formatMoney(hecomFinance.saldoEstimado, "USD"),
                cobros: formatMoney(hecomFinance.cobroTotal, "USD"),
                gastos: formatMoney(hecomFinance.gastoTotal, "USD"),
              })}
            </p>
          ) : null}
          {hecomFinance != null && canClientStripeFund ? (
            <div className="mt-3 rounded-xl border border-[#ff781f]/35 bg-[#fff1e8] px-3.5 py-2.5">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#ff781f]">
                {t("walletCard.feeEyebrow")}
              </p>
              <p className="mt-1 text-[1.35rem] font-bold tracking-[-0.03em] text-[#1c1917]">
                {hecomFinance.depositFeePercent}%
              </p>
              <p className="mt-1 text-[12px] leading-4 text-[#5c564e]">
                {t("walletCard.feeBody", {
                  percent: hecomFinance.depositFeePercent,
                  gross: (
                    100 *
                    (1 + hecomFinance.depositFeePercent / 100)
                  ).toFixed(0),
                })}
              </p>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#5c564e]">
            <span>
              {t("walletCard.lastTopUp")}{" "}
              <span className="font-semibold text-[#1c1917]">
                {wallet.lastTopUp ?? t("walletCard.noRecords")}
              </span>
            </span>
            <span>
              {t("walletCard.method")}{" "}
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
            {t("walletCard.goBm")}
          </a>
        )}
      </div>
    </section>
  );
}
