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

/** Switch dual: Cliente (Stripe) vs Gerente (BM) — solo super admin. */
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
    <section className="dashboard-surface-card overflow-hidden rounded-[1rem]">
      <div className="border-b border-[var(--auth-divider)] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
            Super admin
          </p>
          <span className="dashboard-role-badge" data-role="super_admin">
            Dual
          </span>
        </div>
        <h2 className="mt-1.5 text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
          Cómo vas a recargar
        </h2>
        <p className="mt-1 text-[13px] font-medium text-[var(--auth-text-muted)]">
          Cambiá entre camino cliente (Stripe) y gerente (cash BM).
        </p>
      </div>

      <div
        className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4"
        role="tablist"
        aria-label="Modo de recarga"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "client"}
          disabled={!canClientStripeFund}
          onClick={() => canClientStripeFund && onChange("client")}
          className={cn(
            "rounded-[0.85rem] border px-4 py-3.5 text-left transition-colors",
            mode === "client"
              ? "border-[var(--auth-accent)] bg-[var(--auth-accent-soft)]"
              : "border-[var(--auth-border)] bg-white hover:border-[var(--auth-accent)]/35",
            !canClientStripeFund && "cursor-not-allowed opacity-50",
          )}
        >
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--auth-accent)]">
            Cliente
          </p>
          <p className="mt-1 text-[14px] font-bold text-[var(--auth-text)]">
            Stripe / manual
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--auth-text-muted)]">
            Plata a la cartera Holistic → asignás a la cuenta ads.
          </p>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "agency_bm"}
          disabled={!canAgencyBmFund}
          onClick={() => canAgencyBmFund && onChange("agency_bm")}
          className={cn(
            "rounded-[0.85rem] border px-4 py-3.5 text-left transition-colors",
            mode === "agency_bm"
              ? "border-[var(--auth-text)] bg-[var(--auth-bg)]"
              : "border-[var(--auth-border)] bg-white hover:border-[var(--auth-text)]/25",
            !canAgencyBmFund && "cursor-not-allowed opacity-50",
          )}
        >
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--auth-text-muted)]">
            Gerente
          </p>
          <p className="mt-1 text-[14px] font-bold text-[var(--auth-text)]">
            Cash BM TikTok
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--auth-text-muted)]">
            Sin Stripe: cash del Business Center → cuenta ads.
          </p>
        </button>
      </div>
    </section>
  );
}
