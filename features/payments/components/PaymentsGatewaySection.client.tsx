"use client";

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
                Recargar saldo
              </h2>
              <p className="mt-1 max-w-xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
                Elige un método e ingresa cuánto saldo quieres agregar a la cartera.
              </p>
            </div>
            <PaymentsMoneyFlowGuide />
          </div>

          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <fieldset>
              <legend className="mb-3 text-[13px] font-semibold text-[var(--auth-text)]">
                Método de pago
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
                  ? "No disponible"
                  : selectedGateway
                    ? `Recargar con ${selectedGateway.name}`
                    : "Recargar saldo"}
              </button>
              <WalletSummaryActions
                availableBalance={wallet.balance}
                currency={wallet.currency}
                showAddBalance={false}
              />
            </div>

            <details className="mt-5 border-t border-[var(--auth-divider)] pt-4 text-[12px] text-[var(--auth-text-muted)]">
              <summary className="cursor-pointer font-medium outline-none hover:text-[var(--auth-text)] focus-visible:text-[var(--auth-text)]">
                Detalles de la cartera y comisiones
              </summary>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-[var(--auth-text-soft)]">Cartera</dt>
                  <dd className="mt-0.5 font-medium text-[var(--auth-text)]">
                    {wallet.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--auth-text-soft)]">Última recarga</dt>
                  <dd className="mt-0.5 font-medium text-[var(--auth-text)]">
                    {wallet.lastTopUp ?? "Sin registros"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--auth-text-soft)]">Fee Holistic</dt>
                  <dd className="mt-0.5 font-medium text-[var(--auth-text)]">
                    {depositFeePercent}% sobre el monto neto
                  </dd>
                </div>
              </dl>
            </details>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-[var(--auth-border)] bg-white px-5 py-5 sm:px-6 sm:py-6">
          <h2 className="text-[1.25rem] font-semibold tracking-[-0.025em] text-[var(--auth-text)]">
            Recargar desde el Business Center
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
            Elige una cuenta de TikTok y transfiere el saldo disponible del BM.
          </p>
          <a
            href="#asignar-saldo"
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-semibold text-white transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/35 focus-visible:ring-offset-2"
          >
            Elegir cuenta
          </a>
        </section>
      )}
    </div>
  );
}

export type { PaymentsFundingMode } from "./PaymentsFundingModeSwitch.client";
