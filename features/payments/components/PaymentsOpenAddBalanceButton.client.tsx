"use client";

import { dispatchPaymentsOpenAddBalanceModal } from "@/lib/events/modal-events";

interface PaymentsOpenAddBalanceButtonProps {
  children: React.ReactNode;
  className?: string;
}

export function PaymentsOpenAddBalanceButton({
  children,
  className,
}: PaymentsOpenAddBalanceButtonProps) {
  return (
    <button
      type="button"
      onClick={dispatchPaymentsOpenAddBalanceModal}
      className={className}
    >
      {children}
    </button>
  );
}
