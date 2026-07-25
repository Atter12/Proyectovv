"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { PAYMENTS_OPEN_ADD_BALANCE_MODAL } from "@/lib/events/modal-events";
import { PaymentsGatewaySection } from "./PaymentsGatewaySection.client";
import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";

const AddBalanceModal = dynamic(
  () => import("./AddBalanceModal.client").then((m) => m.AddBalanceModal),
  { ssr: false },
);

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
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    function handleOpenModal() {
      setModalOpen(true);
    }
    window.addEventListener(PAYMENTS_OPEN_ADD_BALANCE_MODAL, handleOpenModal);
    return () =>
      window.removeEventListener(
        PAYMENTS_OPEN_ADD_BALANCE_MODAL,
        handleOpenModal,
      );
  }, []);

  function handleSelectGateway(id: PaymentGatewayId) {
    setSelectedGateway(id);
    // Selecting Stripe/Culqi/etc. opens pay flow immediately — no scroll hunt
    setModalOpen(true);
  }

  return (
    <>
      <PaymentsGatewaySection
        gateways={gateways}
        selected={selectedGateway}
        onSelect={handleSelectGateway}
        onContinue={() => setModalOpen(true)}
      />

      {modalOpen ? (
        <AddBalanceModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          selectedGateway={selectedGateway}
        />
      ) : null}
    </>
  );
}
