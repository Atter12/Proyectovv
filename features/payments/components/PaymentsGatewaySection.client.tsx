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
        <section className="overflow-hidden rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
          <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a5a38]">
              1 · Cliente · Cartera Holistic
            </p>
            <h2 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-[#1a1612]">
              Recargar cartera Holistic
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-[#6b645c]">
              Esto no paga TikTok directo. Recargás la cartera Holistic y después
              asignás a una cuenta ads.
            </p>
          </div>

          <div className="px-5 py-4 sm:px-6 sm:py-5">
            <PaymentGatewaySelector
              gateways={gateways}
              selected={selected}
              onSelect={onSelect}
            />

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-[#faf7f3] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#7a736a]">
                  Siguiente paso
                </p>
                <p className="mt-0.5 text-[13px] text-[#2a241f]">
                  {selectedGateway
                    ? `Continuar con ${selectedGateway.name}`
                    : "Seleccioná un método para continuar"}
                </p>
              </div>
              <button
                type="button"
                onClick={onContinue}
                className="inline-flex h-9 w-full shrink-0 items-center justify-center rounded-lg bg-[#e85a1c] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#d14e16] sm:w-auto"
              >
                {selectedGateway
                  ? `Pagar con ${selectedGateway.name}`
                  : "Agregar saldo"}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] px-5 py-4 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)] sm:px-6 sm:py-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a5a38]">
            1 · Gerente · Cash BM
          </p>
          <h2 className="mt-1 text-[15px] font-medium text-[#1a1612]">
            Sin Stripe en este paso
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
            Bajá a <span className="font-medium text-[#1a1612]">Asignar</span> y
            fondeá la cuenta ads con cash del Business Center. Holistic registra
            un puente contable automático.
          </p>
          <a
            href="#asignar-saldo"
            className="mt-3 inline-flex h-9 items-center rounded-lg bg-[#e85a1c] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#d14e16]"
          >
            Ir a fondear cuenta ads
          </a>
        </section>
      )}
    </div>
  );
}

/** Host client que mantiene el modo de fondeo — ver PaymentsFundingModeContext. */
export type { PaymentsFundingMode } from "./PaymentsFundingModeSwitch.client";
