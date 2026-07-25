"use client";

import { dispatchPaymentsOpenAddBalanceModal } from "@/lib/events/modal-events";
import { PaymentGatewaySelector } from "./PaymentGatewaySelector.client";
import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";

interface PaymentsGatewaySectionProps {
  gateways: PaymentGateway[];
  selected: PaymentGatewayId;
  onSelect: (id: PaymentGatewayId) => void;
}

export function PaymentsGatewaySection({
  gateways,
  selected,
  onSelect,
}: PaymentsGatewaySectionProps) {
  const selectedGateway = gateways.find((g) => g.id === selected);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Método de pago
          </h2>
          <p className="mt-1 text-[13px] text-[var(--admin-text-muted,#64748b)]">
            Elige cómo quieres agregar saldo y continúa.
          </p>
        </div>
        <button
          type="button"
          onClick={dispatchPaymentsOpenAddBalanceModal}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-deep)] sm:h-10 sm:w-auto"
        >
          Continuar{selectedGateway ? ` con ${selectedGateway.name}` : ""}
        </button>
      </div>
      <PaymentGatewaySelector
        gateways={gateways}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}
