"use client";

import { useState } from "react";
import { PaymentOverviewStats } from "./PaymentOverviewStats";
import { PaymentsAddBalanceModalHost } from "./PaymentsAddBalanceModalHost.client";
import { PaymentsGatewaySection } from "./PaymentsGatewaySection.client";
import type {
  PaymentGateway,
  PaymentGatewayId,
  PaymentOverview,
} from "@/types/payment";

interface PaymentsGatewayBlockProps {
  gateways: PaymentGateway[];
  initialSelected: PaymentGatewayId;
  wallet: PaymentOverview["wallet"];
  summary: PaymentOverview["summary"];
}

export function PaymentsGatewayBlock({
  gateways,
  initialSelected,
  wallet,
  summary,
}: PaymentsGatewayBlockProps) {
  const [selectedGateway, setSelectedGateway] =
    useState<PaymentGatewayId>(initialSelected);

  const activeGateway =
    gateways.find((gateway) => gateway.id === selectedGateway) ?? gateways[0]!;

  return (
    <>
      <PaymentOverviewStats
        wallet={wallet}
        summary={summary}
        activeGateway={activeGateway}
      />

      <PaymentsGatewaySection
        gateways={gateways}
        selected={selectedGateway}
        onSelect={setSelectedGateway}
      />

      <PaymentsAddBalanceModalHost selectedGateway={selectedGateway} />
    </>
  );
}
