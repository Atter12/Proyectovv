"use client";

import { cn } from "@/lib/cn";

export type PaymentsFundingMode = "client" | "agency_bm";

interface PaymentsFundingModeSwitchProps {
  mode: PaymentsFundingMode;
  onChange: (mode: PaymentsFundingMode) => void;
  canClientStripeFund: boolean;
  canAgencyBmFund: boolean;
  canSwitchFundingModes: boolean;
}

/** Selector visible: Cliente (Stripe) vs Gerente (cash BM). */
export function PaymentsFundingModeSwitch({
  mode,
  onChange,
  canClientStripeFund,
  canAgencyBmFund,
  canSwitchFundingModes,
}: PaymentsFundingModeSwitchProps) {
  if (!canSwitchFundingModes) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]">
      <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
          Cómo vas a fondear
        </p>
        <h2 className="font-display mt-1.5 text-[1.25rem] font-semibold tracking-[-0.03em] text-[var(--auth-text)]">
          Elegí el camino
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
          Super admin: cliente (Stripe) o gerente (cash BM).
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <button
          type="button"
          disabled={!canClientStripeFund}
          onClick={() => canClientStripeFund && onChange("client")}
          className={cn(
            "rounded-[1.1rem] border px-4 py-3.5 text-left transition-[transform,box-shadow,border-color]",
            mode === "client"
              ? "border-[var(--auth-accent)] bg-[rgb(255_120_31_/_0.08)] shadow-[0_10px_24px_rgb(255_120_31_/_0.12)]"
              : "border-[rgb(20_18_16_/_0.08)] bg-white hover:-translate-y-0.5 hover:border-[rgb(255_120_31_/_0.3)]",
            !canClientStripeFund &&
              "cursor-not-allowed opacity-55 hover:translate-y-0 hover:border-[rgb(20_18_16_/_0.08)]",
          )}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">
            Cliente
          </p>
          <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
            Recargar con Stripe / manual
          </p>
          <p className="mt-1 text-[12px] leading-4 text-[var(--auth-text-muted)]">
            Plata a la cartera Holistic y después asignás a la cuenta ads.
          </p>
        </button>

        <button
          type="button"
          disabled={!canAgencyBmFund}
          onClick={() => canAgencyBmFund && onChange("agency_bm")}
          className={cn(
            "rounded-[1.1rem] border px-4 py-3.5 text-left transition-[transform,box-shadow,border-color]",
            mode === "agency_bm"
              ? "border-[var(--auth-accent)] bg-[rgb(255_120_31_/_0.08)] shadow-[0_10px_24px_rgb(255_120_31_/_0.12)]"
              : "border-[rgb(20_18_16_/_0.08)] bg-white hover:-translate-y-0.5 hover:border-[rgb(255_120_31_/_0.3)]",
            !canAgencyBmFund &&
              "cursor-not-allowed opacity-55 hover:translate-y-0 hover:border-[rgb(20_18_16_/_0.08)]",
          )}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">
            Gerente / staff
          </p>
          <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
            Fondear desde BM (cash agencia)
          </p>
          <p className="mt-1 text-[12px] leading-4 text-[var(--auth-text-muted)]">
            Sin Stripe: cash del Business Center → cuenta ads del cliente.
          </p>
        </button>
      </div>
    </section>
  );
}
