"use client";

import { useState } from "react";
import { PaymentsAddBalanceModalHost } from "./PaymentsAddBalanceModalHost.client";
import { PaymentsGatewaySection } from "./PaymentsGatewaySection.client";
import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";

interface PaymentsGatewayBlockClientProps {
  gateways: PaymentGateway[];
  initialSelected: PaymentGatewayId;
}

export function PaymentsGatewayBlockClient({
  gateways,
  initialSelected,
}: PaymentsGatewayBlockClientProps) {
  const [selectedGateway, setSelectedGateway] =
    useState<PaymentGatewayId>(initialSelected);

  return (
    <>
      <PaymentsGatewaySection
        gateways={gateways}
        selected={selectedGateway}
        onSelect={setSelectedGateway}
      />

      <PaymentsAddBalanceModalHost selectedGateway={selectedGateway} />
    </>
  );
}
