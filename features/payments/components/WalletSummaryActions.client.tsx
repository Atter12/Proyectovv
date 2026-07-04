"use client";

import { Button } from "@/components/ui/Button";
import { dispatchPaymentsOpenAddBalanceModal } from "@/lib/events/modal-events";

export function WalletSummaryActions() {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <Button
        variant="outline"
        className="h-10 w-full rounded-xl border-[#dbe1ea] sm:w-auto"
      >
        Reembolso
      </Button>
      <Button
        onClick={dispatchPaymentsOpenAddBalanceModal}
        className="h-10 w-full rounded-xl bg-[#4056ff] shadow-sm hover:bg-[#4056ff]/90 sm:w-auto"
      >
        Agregar saldo
      </Button>
    </div>
  );
}
