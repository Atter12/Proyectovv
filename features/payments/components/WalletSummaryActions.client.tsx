"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { dispatchPaymentsOpenAddBalanceModal } from "@/lib/events/modal-events";
import { RefundRequestModal } from "./RefundRequestModal.client";

interface WalletSummaryActionsProps {
  availableBalance: number;
  currency: string;
}

export function WalletSummaryActions({
  availableBalance,
  currency,
}: WalletSummaryActionsProps) {
  const [refundOpen, setRefundOpen] = useState(false);

  return (
    <>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button
          variant="outline"
          onClick={() => setRefundOpen(true)}
          className="h-10 w-full rounded-xl border-[#dbe1ea] sm:w-auto"
        >
          Reembolso
        </Button>
        <Button
          onClick={dispatchPaymentsOpenAddBalanceModal}
          className="h-10 w-full rounded-xl bg-[var(--brand-primary)] shadow-sm hover:bg-[var(--brand-primary)]/90 sm:w-auto"
        >
          Agregar saldo
        </Button>
      </div>
      <RefundRequestModal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        availableBalance={availableBalance}
        currency={currency}
      />
    </>
  );
}
