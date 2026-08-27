"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { PAYMENTS_OPEN_ADD_BALANCE_MODAL } from "@/lib/events/modal-events";
import { PaymentsGatewaySection } from "./PaymentsGatewaySection.client";
import { usePaymentsFundingMode } from "./PaymentsFundingModeContext.client";
import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";

const AddBalanceModal = dynamic(
  () => import("./AddBalanceModal.client").then((m) => m.AddBalanceModal),
  { ssr: false },
);

const AutoRechargeSchedule = dynamic(
  () =>
    import("./AutoRechargeSchedule.client").then((m) => m.AutoRechargeSchedule),
  { ssr: false },
);

interface PaymentsGatewayBlockClientProps {
  gateways: PaymentGateway[];
  initialSelected: PaymentGatewayId;
  /** Fee % Hecom del cliente activo. */
  depositFeePercent?: number;
}

export function PaymentsGatewayBlockClient({
  gateways,
  initialSelected,
  depositFeePercent = 10,
}: PaymentsGatewayBlockClientProps) {
  const {
    fundingMode,
    setFundingMode,
    canClientStripeFund,
    canAgencyBmFund,
    canSwitchFundingModes,
  } = usePaymentsFundingMode();
  const [selectedGateway, setSelectedGateway] =
    useState<PaymentGatewayId>(initialSelected);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    function handleOpenModal() {
      if (!canClientStripeFund) return;
      setModalOpen(true);
    }
    window.addEventListener(PAYMENTS_OPEN_ADD_BALANCE_MODAL, handleOpenModal);
    return () =>
      window.removeEventListener(
        PAYMENTS_OPEN_ADD_BALANCE_MODAL,
        handleOpenModal,
      );
  }, [canClientStripeFund]);

  function handleSelectGateway(id: PaymentGatewayId) {
    if (!canClientStripeFund) return;
    const gateway = gateways.find((g) => g.id === id);
    if (gateway?.maintenance) return;
    setSelectedGateway(id);
    setModalOpen(true);
  }

  return (
    <>
      <PaymentsGatewaySection
        gateways={gateways}
        selected={selectedGateway}
        onSelect={handleSelectGateway}
        onContinue={() => {
          if (!canClientStripeFund) return;
          const gateway = gateways.find((g) => g.id === selectedGateway);
          if (gateway?.maintenance) return;
          setModalOpen(true);
        }}
        fundingMode={fundingMode}
        onFundingModeChange={setFundingMode}
        canClientStripeFund={canClientStripeFund}
        canAgencyBmFund={canAgencyBmFund}
        canSwitchFundingModes={canSwitchFundingModes}
        depositFeePercent={depositFeePercent}
      />

      {canClientStripeFund && modalOpen && selectedGateway !== "manual" ? (
        <AddBalanceModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          selectedGateway={selectedGateway}
          feePercent={depositFeePercent}
        />
      ) : null}

      {canClientStripeFund ? (
        <Suspense fallback={null}>
          <AutoRechargeSchedule depositFeePercent={depositFeePercent} />
        </Suspense>
      ) : null}
    </>
  );
}
