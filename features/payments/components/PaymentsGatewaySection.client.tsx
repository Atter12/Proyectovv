"use client";

import { PaymentGatewaySelector } from "./PaymentGatewaySelector.client";
import {
  PaymentsFundingModeSwitch,
  type PaymentsFundingMode,
} from "./PaymentsFundingModeSwitch.client";
import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";

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
}: PaymentsGatewaySectionProps) {
  const selectedGateway = gateways.find((g) => g.id === selected);
  const showClientDeposit =
    canClientStripeFund && fundingMode === "client";

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
        <section className="dashboard-surface-card overflow-hidden rounded-[1rem]">
          <div className="border-b border-[var(--auth-border)] px-5 py-4 sm:px-6">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
              Cliente · Cartera Holistic
            </p>
            <h2 className="mt-1.5 text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
              Recargar cartera
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
              No paga TikTok directo: recargás la cartera y después asignás a
              una cuenta ads.
            </p>
          </div>

          <div className="px-5 py-4 sm:px-6 sm:py-5">
            <PaymentGatewaySelector
              gateways={gateways}
              selected={selected}
              onSelect={onSelect}
            />

            <div className="mt-4 flex flex-col gap-3 rounded-[0.85rem] border border-[var(--auth-border)] bg-[var(--auth-bg)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
                  Siguiente paso
                </p>
                <p className="mt-0.5 text-[13px] font-medium text-[var(--auth-text)]">
                  {selectedGateway
                    ? `Continuar con ${selectedGateway.name}`
                    : "Seleccioná un método para continuar"}
                </p>
              </div>
              <button
                type="button"
                onClick={onContinue}
                className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-lg bg-[var(--auth-accent)] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05] sm:w-auto"
              >
                {selectedGateway
                  ? `Pagar con ${selectedGateway.name}`
                  : "Agregar saldo"}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="dashboard-surface-card rounded-[1rem] px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
            Gerente · Cash BM
          </p>
          <h2 className="mt-1.5 text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
            Sin Stripe en este paso
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
            Bajá a{" "}
            <span className="font-semibold text-[var(--auth-text)]">Asignar</span>{" "}
            y fondeá la cuenta ads con cash del Business Center.
          </p>
          <a
            href="#asignar-saldo"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-[var(--auth-accent)] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
          >
            Ir a fondear cuenta ads
          </a>
        </section>
      )}
    </div>
  );
}

export type { PaymentsFundingMode } from "./PaymentsFundingModeSwitch.client";
