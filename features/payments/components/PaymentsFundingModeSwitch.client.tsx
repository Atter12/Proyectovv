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
    // Un solo camino: no hace falta el switch.
    return null;
  }

  return (
    <section className="overflow-hidden rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
      <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a5a38]">
          Cómo vas a fondear
        </p>
        <h2 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-[#1a1612]">
          Elegí el camino
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
          Super admin: podés operar como cliente (Stripe) o como gerente (cash
          BM).
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <button
          type="button"
          disabled={!canClientStripeFund}
          onClick={() => canClientStripeFund && onChange("client")}
          className={cn(
            "rounded-xl border px-4 py-3.5 text-left transition-colors",
            mode === "client"
              ? "border-[var(--auth-accent)] bg-[rgb(255_120_31_/_0.08)]"
              : "border-[rgb(20_18_16_/_0.08)] bg-white hover:bg-[#faf7f3]",
            !canClientStripeFund &&
              "cursor-not-allowed opacity-55 hover:bg-white",
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a5a38]">
            Cliente
          </p>
          <p className="mt-1 text-[14px] font-semibold text-[#1a1612]">
            Recargar con Stripe / manual
          </p>
          <p className="mt-1 text-[12px] leading-4 text-[#6b645c]">
            El cliente mete plata a la cartera Holistic y después asigna a la
            cuenta ads.
          </p>
        </button>

        <button
          type="button"
          disabled={!canAgencyBmFund}
          onClick={() => canAgencyBmFund && onChange("agency_bm")}
          className={cn(
            "rounded-xl border px-4 py-3.5 text-left transition-colors",
            mode === "agency_bm"
              ? "border-[var(--auth-accent)] bg-[rgb(255_120_31_/_0.08)]"
              : "border-[rgb(20_18_16_/_0.08)] bg-white hover:bg-[#faf7f3]",
            !canAgencyBmFund && "cursor-not-allowed opacity-55 hover:bg-white",
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a5a38]">
            Gerente / staff
          </p>
          <p className="mt-1 text-[14px] font-semibold text-[#1a1612]">
            Fondear desde BM (cash agencia)
          </p>
          <p className="mt-1 text-[12px] leading-4 text-[#6b645c]">
            Sin Stripe: movés cash del Business Center a la cuenta ads del
            cliente.
          </p>
        </button>
      </div>
    </section>
  );
}
