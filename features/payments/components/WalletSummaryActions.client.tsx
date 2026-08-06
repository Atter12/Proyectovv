"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { dispatchPaymentsOpenAddBalanceModal } from "@/lib/events/modal-events";
import { RefundRequestModal } from "./RefundRequestModal.client";

interface WalletSummaryActionsProps {
  availableBalance: number;
  currency: string;
  tone?: "light" | "dark";
}

export function WalletSummaryActions({
  availableBalance,
  currency,
  tone = "light",
}: WalletSummaryActionsProps) {
  const [refundOpen, setRefundOpen] = useState(false);
  const isDark = tone === "dark";

  return (
    <>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row-reverse sm:items-center">
        <Button
          onClick={dispatchPaymentsOpenAddBalanceModal}
          className={
            isDark
              ? "h-11 w-full rounded-xl bg-[var(--auth-accent)] text-[14px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.35)] hover:brightness-[1.05] sm:w-auto"
              : "h-9 w-full rounded-lg bg-[#e85a1c] text-[13px] font-medium hover:bg-[#d14e16] sm:w-auto"
          }
        >
          Agregar saldo
        </Button>
        <Button
          variant="outline"
          onClick={() => setRefundOpen(true)}
          className={
            isDark
              ? "h-11 w-full rounded-xl border-white/25 bg-transparent text-[14px] font-semibold text-white hover:bg-white/10 sm:w-auto"
              : "h-9 w-full rounded-lg border-[rgb(20_18_16_/_0.12)] text-[13px] font-normal text-[#4a433c] hover:bg-[#f3eee8] sm:w-auto"
          }
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
