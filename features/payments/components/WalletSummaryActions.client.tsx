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
  showAddBalance?: boolean;
}

export function WalletSummaryActions({
  availableBalance,
  currency,
  showAddBalance = true,
}: WalletSummaryActionsProps) {
  const [refundOpen, setRefundOpen] = useState(false);

  return (
    <>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row-reverse sm:items-center">
        {showAddBalance ? (
          <Button
            onClick={dispatchPaymentsOpenAddBalanceModal}
            className="h-11 w-full rounded-xl bg-[#ff781f] text-[13px] font-semibold text-white hover:brightness-[1.05] sm:w-auto"
          >
            Recargar saldo
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() => setRefundOpen(true)}
          disabled={availableBalance <= 0}
          className="h-11 w-full rounded-xl border-[#ece7e0] bg-white text-[13px] font-semibold text-[#1c1917] hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Solicitar reembolso
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
