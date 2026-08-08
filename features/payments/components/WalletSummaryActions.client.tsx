"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { dispatchPaymentsOpenAddBalanceModal } from "@/lib/events/modal-events";
import { RefundRequestModal } from "./RefundRequestModal.client";

interface WalletSummaryActionsProps {
  availableBalance: number;
  currency: string;
  /** @deprecated Se ignora; UI siempre light. */
  tone?: "light" | "dark";
}

export function WalletSummaryActions({
  availableBalance,
  currency,
}: WalletSummaryActionsProps) {
  const [refundOpen, setRefundOpen] = useState(false);

  return (
    <>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row-reverse sm:items-center">
        <Button
          onClick={dispatchPaymentsOpenAddBalanceModal}
          className="h-10 w-full rounded-lg bg-[#ff781f] text-[13px] font-semibold text-white hover:brightness-[1.05] sm:w-auto"
        >
          Agregar saldo
        </Button>
        <Button
          variant="outline"
          onClick={() => setRefundOpen(true)}
          className="h-10 w-full rounded-lg border-[#ece7e0] bg-white text-[13px] font-semibold text-[#1c1917] hover:bg-[#faf8f5] sm:w-auto"
        >
          Reembolso
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
