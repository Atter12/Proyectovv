"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { PAYMENTS_OPEN_ADD_BALANCE_MODAL } from "@/lib/events/modal-events";
import type { PaymentGatewayId } from "@/types/payment";

const AddBalanceModal = dynamic(
  () => import("./AddBalanceModal.client").then((m) => m.AddBalanceModal),
  { ssr: false },
);

interface PaymentsAddBalanceModalHostProps {
  selectedGateway: PaymentGatewayId;
}

export function PaymentsAddBalanceModalHost({
  selectedGateway,
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

  return (
    <AddBalanceModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      selectedGateway={selectedGateway}
    />
  );
}
