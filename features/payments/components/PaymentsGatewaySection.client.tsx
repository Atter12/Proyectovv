"use client";

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
  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold text-[#0f172a]">
        Método de pago
      </h2>
      <PaymentGatewaySelector
        gateways={gateways}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}
