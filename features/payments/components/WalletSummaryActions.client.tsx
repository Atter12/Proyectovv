"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { dispatchPaymentsOpenAddBalanceModal } from "@/lib/events/modal-events";

interface WalletSummaryActionsProps {
  availableBalance: number;
  currency: string;
  /** @deprecated Se ignora; UI siempre light. */
  tone?: "light" | "dark";
  showAddBalance?: boolean;
}

export function WalletSummaryActions({
  showAddBalance = true,
}: WalletSummaryActionsProps) {
  const t = useTranslations("payments");

  if (!showAddBalance) return null;

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row-reverse sm:items-center">
      <Button
        onClick={dispatchPaymentsOpenAddBalanceModal}
        className="h-11 w-full rounded-xl bg-[#ff781f] text-[13px] font-semibold text-white hover:brightness-[1.05] sm:w-auto"
      >
        {t("walletCard.reload")}
      </Button>
    </div>
  );
}
