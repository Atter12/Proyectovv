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
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row-reverse sm:items-center">
        <Button
          onClick={dispatchPaymentsOpenAddBalanceModal}
          className="h-11 w-full rounded-xl bg-[var(--brand-primary)] text-[14px] font-semibold shadow-sm hover:bg-[var(--brand-primary-deep)] sm:h-10 sm:w-auto"
        >
          Agregar saldo
        </Button>
        <Button
          variant="outline"
          onClick={() => setRefundOpen(true)}
          className="h-11 w-full rounded-xl border-[var(--border-subtle)] text-[14px] font-medium sm:h-10 sm:w-auto"
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
