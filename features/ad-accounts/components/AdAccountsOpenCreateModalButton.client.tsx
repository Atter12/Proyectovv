"use client";

import { dispatchAdAccountsOpenCreateModal } from "@/lib/events/modal-events";

interface AdAccountsOpenCreateModalButtonProps {
  children: React.ReactNode;
  className?: string;
}

export function AdAccountsOpenCreateModalButton({
  children,
  className,
}: AdAccountsOpenCreateModalButtonProps) {
  return (
    <button
      type="button"
      onClick={dispatchAdAccountsOpenCreateModal}
      className={className}
    >
      {children}
    </button>
  );
}
