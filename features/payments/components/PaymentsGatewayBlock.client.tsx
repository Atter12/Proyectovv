"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { PAYMENTS_OPEN_ADD_BALANCE_MODAL } from "@/lib/events/modal-events";
import { PaymentsGatewaySection } from "./PaymentsGatewaySection.client";
import { usePaymentsFundingMode } from "./PaymentsFundingModeContext.client";
import type {
  PaymentGateway,
  PaymentGatewayId,
  WalletOverview,
} from "@/types/payment";

const AddBalanceModal = dynamic(
  () => import("./AddBalanceModal.client").then((m) => m.AddBalanceModal),
  { ssr: false },
);

const ManualPaymentModal = dynamic(
  () =>
    import("./ManualPaymentModal.client").then((m) => m.ManualPaymentModal),
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
  wallet: WalletOverview;
  depositFeePercent?: number;
}

export function PaymentsGatewayBlockClient({
  gateways,
  initialSelected,
  wallet,
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
    const gateway = gateways.find((item) => item.id === id);
    if (gateway?.maintenance) return;
    setSelectedGateway(id);
  }

  return (
    <>
      <PaymentsGatewaySection
        gateways={gateways}
        selected={selectedGateway}
        onSelect={handleSelectGateway}
        onContinue={() => {
          if (!canClientStripeFund) return;
          const gateway = gateways.find((item) => item.id === selectedGateway);
          if (gateway?.maintenance) return;
          setModalOpen(true);
        }}
        fundingMode={fundingMode}
        onFundingModeChange={setFundingMode}
        canClientStripeFund={canClientStripeFund}
        canAgencyBmFund={canAgencyBmFund}
        canSwitchFundingModes={canSwitchFundingModes}
        wallet={wallet}
        depositFeePercent={depositFeePercent}
      />

      {canClientStripeFund && modalOpen && selectedGateway === "manual" ? (
        <ManualPaymentModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          feePercent={depositFeePercent}
        />
      ) : null}

      {canClientStripeFund && modalOpen && selectedGateway !== "manual" ? (
        <AddBalanceModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          selectedGateway={selectedGateway}
          feePercent={depositFeePercent}
        />
      ) : null}

      {canClientStripeFund ? (
        <details className="group overflow-hidden rounded-2xl border border-[var(--auth-border)] bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3.5 text-[13px] font-semibold text-[var(--auth-text)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--auth-accent)]/30 sm:px-6">
            <span>Configurar recarga automática</span>
            <span
              aria-hidden
              className="text-[var(--auth-text-soft)] transition-transform group-open:rotate-180"
            >
              ↓
            </span>
          </summary>
          <div className="border-t border-[var(--auth-divider)] p-4 sm:p-5">
            <Suspense fallback={null}>
              <AutoRechargeSchedule depositFeePercent={depositFeePercent} />
            </Suspense>
          </div>
        </details>
      ) : null}
    </>
  );
}
