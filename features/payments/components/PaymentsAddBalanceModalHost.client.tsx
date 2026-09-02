"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { PAYMENTS_OPEN_ADD_BALANCE_MODAL } from "@/lib/events/modal-events";
import type { PaymentGatewayId } from "@/types/payment";

const AddBalanceModal = dynamic(
  () => import("./AddBalanceModal.client").then((m) => m.AddBalanceModal),
  { ssr: false },
);

const ManualPaymentModal = dynamic(
  () =>
    import("./ManualPaymentModal.client").then((m) => m.ManualPaymentModal),
  { ssr: false },
);

interface PaymentsAddBalanceModalHostProps {
  selectedGateway: PaymentGatewayId;
  depositFeePercent?: number;
}

export function PaymentsAddBalanceModalHost({
  selectedGateway,
  depositFeePercent = 10,
}: PaymentsAddBalanceModalHostProps) {
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

  if (!modalOpen) return null;

  if (selectedGateway === "manual") {
    return (
      <ManualPaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        feePercent={depositFeePercent}
      />
    );
  }

  return (
    <AddBalanceModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      selectedGateway={selectedGateway}
      feePercent={depositFeePercent}
    />
  );
}
