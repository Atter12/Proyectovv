"use client";

import { dispatchPaymentsOpenAddBalanceModal } from "@/lib/events/modal-events";

/**
 * Persistent primary recharge CTA on small screens so users never need to
 * scroll to the wallet card / empty state to top up.
 */
export function PaymentsMobileStickyCta() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="pointer-events-auto border-t border-[var(--border-subtle)] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgb(15_23_42_/_0.08)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1620px] items-center gap-3 pr-16">
          <button
            type="button"
            onClick={dispatchPaymentsOpenAddBalanceModal}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-[15px] font-semibold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.32)] transition-colors hover:bg-[var(--brand-primary-deep)] active:translate-y-px"
          >
            Agregar saldo
          </button>
        </div>
      </div>
    </div>
  );
}
