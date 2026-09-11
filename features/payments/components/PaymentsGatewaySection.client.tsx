"use client";

import { useTranslations } from "next-intl";
import { PaymentGatewaySelector } from "./PaymentGatewaySelector.client";
import { PaymentsMoneyFlowGuide } from "./PaymentsMoneyFlowGuide";
import {
  PaymentsFundingModeSwitch,
  type PaymentsFundingMode,
} from "./PaymentsFundingModeSwitch.client";
import { WalletSummaryActions } from "./WalletSummaryActions.client";
import type {
  PaymentGateway,
  PaymentGatewayId,
  WalletOverview,
} from "@/types/payment";

interface PaymentsGatewaySectionProps {
  gateways: PaymentGateway[];
  selected: PaymentGatewayId;
  onSelect: (id: PaymentGatewayId) => void;
  onContinue: () => void;
  fundingMode: PaymentsFundingMode;
  onFundingModeChange: (mode: PaymentsFundingMode) => void;
  canClientStripeFund: boolean;
  canAgencyBmFund: boolean;
  canSwitchFundingModes: boolean;
  wallet: WalletOverview;
  depositFeePercent?: number;
}

export function PaymentsGatewaySection({
  gateways,
  selected,
  onSelect,
  onContinue,
  fundingMode,
  onFundingModeChange,
  canClientStripeFund,
  canAgencyBmFund,
  canSwitchFundingModes,
  wallet,
  depositFeePercent = 10,
}: PaymentsGatewaySectionProps) {
  const t = useTranslations("payments");
  const selectedGateway = gateways.find((gateway) => gateway.id === selected);
  const selectedInMaintenance = Boolean(selectedGateway?.maintenance);
  const showClientDeposit = canClientStripeFund && fundingMode === "client";

  return (
    <div className="space-y-5">
      <PaymentsFundingModeSwitch
        mode={fundingMode}
        onChange={onFundingModeChange}
        canClientStripeFund={canClientStripeFund}
        canAgencyBmFund={canAgencyBmFund}
        canSwitchFundingModes={canSwitchFundingModes}
      />

      {showClientDeposit ? (
        <section
          id="recargar-saldo"
          className="overflow-hidden rounded-2xl border border-[var(--auth-border)] bg-white"
        >
          <div className="border-b border-[var(--auth-divider)] px-5 py-5 sm:px-6">
            {/*
             * El saldo ya está fijo en la barra lateral y otra vez en “Asignar
             * saldo”, donde sí aporta (compara contra TikTok). Repetirlo acá
             * era la tercera copia del mismo número.
             */}
            <div className="min-w-0">
              <h2 className="text-[1.25rem] font-semibold tracking-[-0.025em] text-[var(--auth-text)]">
                {t("reloadSection.title")}
              </h2>
              <p className="mt-1 max-w-xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
                {t("reloadSection.body")}
              </p>
            </div>
            <PaymentsMoneyFlowGuide />
          </div>

          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <fieldset>
              <legend className="mb-3 text-[13px] font-semibold text-[var(--auth-text)]">
                {t("reloadSection.method")}
              </legend>
              <PaymentGatewaySelector
                gateways={gateways}
                selected={selected}
                onSelect={onSelect}
              />
            </fieldset>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onContinue}
                disabled={selectedInMaintenance || !selectedGateway}
                className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.2)] transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {selectedInMaintenance
                  ? t("reloadSection.unavailable")
                  : selectedGateway
                    ? t("reloadSection.reloadWith", {
                        name: selectedGateway.name,
                      })
                    : t("reloadSection.title")}
              </button>
              <WalletSummaryActions
                availableBalance={wallet.balance}
                currency={wallet.currency}
                showAddBalance={false}
              />
            </div>

            <details className="mt-5 border-t border-[var(--auth-divider)] pt-4 text-[12px] text-[var(--auth-text-muted)]">
              <summary className="cursor-pointer font-medium outline-none hover:text-[var(--auth-text)] focus-visible:text-[var(--auth-text)]">
                {t("reloadSection.walletDetails")}
              </summary>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-[var(--auth-text-soft)]">
                    {t("reloadSection.wallet")}
                  </dt>
                  <dd className="mt-0.5 font-medium text-[var(--auth-text)]">
                    {wallet.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--auth-text-soft)]">
                    {t("reloadSection.lastTopUp")}
                  </dt>
                  <dd className="mt-0.5 font-medium text-[var(--auth-text)]">
                    {wallet.lastTopUp ?? t("walletCard.noRecords")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--auth-text-soft)]">
                    {t("reloadSection.feeHolistic")}
                  </dt>
                  <dd className="mt-0.5 font-medium text-[var(--auth-text)]">
                    {t("reloadSection.feeOnNet", {
                      percent: depositFeePercent,
                    })}
                  </dd>
                </div>
              </dl>
            </details>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-[var(--auth-border)] bg-white px-5 py-5 sm:px-6 sm:py-6">
          <h2 className="text-[1.25rem] font-semibold tracking-[-0.025em] text-[var(--auth-text)]">
            {t("reloadSection.bmTitle")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
            {t("reloadSection.bmBody")}
          </p>
          <a
            href="#asignar-saldo"
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-semibold text-white transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/35 focus-visible:ring-offset-2"
          >
            {t("reloadSection.pickAccount")}
          </a>
        </section>
      )}
    </div>
  );
}

export type { PaymentsFundingMode } from "./PaymentsFundingModeSwitch.client";
