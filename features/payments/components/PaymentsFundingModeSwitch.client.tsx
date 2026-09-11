"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type PaymentsFundingMode = "client" | "agency_bm";

interface PaymentsFundingModeSwitchProps {
  mode: PaymentsFundingMode;
  onChange: (mode: PaymentsFundingMode) => void;
  canClientStripeFund: boolean;
  canAgencyBmFund: boolean;
  canSwitchFundingModes: boolean;
}

export function PaymentsFundingModeSwitch({
  mode,
  onChange,
  canClientStripeFund,
  canAgencyBmFund,
  canSwitchFundingModes,
}: PaymentsFundingModeSwitchProps) {
  const t = useTranslations("payments");

  if (!canSwitchFundingModes) return null;

  return (
    <section className="rounded-2xl border border-[var(--auth-border)] bg-white p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="px-1 pb-3 sm:pb-0">
        <h2 className="text-[14px] font-semibold text-[var(--auth-text)]">
          {t("fundingMode.title")}
        </h2>
        <p className="mt-0.5 text-[12px] text-[var(--auth-text-muted)]">
          {t("fundingMode.body")}
        </p>
      </div>
      <div
        className="grid gap-1 rounded-xl bg-[var(--auth-bg)] p-1 sm:min-w-[24rem] sm:grid-cols-2"
        role="radiogroup"
        aria-label={t("fundingMode.aria")}
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === "client"}
          disabled={!canClientStripeFund}
          onClick={() => canClientStripeFund && onChange("client")}
          className={cn(
            "min-h-11 rounded-lg px-4 py-2 text-left transition-[background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/30",
            mode === "client" ? "bg-white shadow-sm" : "hover:bg-white/70",
            !canClientStripeFund && "cursor-not-allowed opacity-50",
          )}
        >
          <span className="block text-[13px] font-semibold text-[var(--auth-text)]">
            {t("fundingMode.wallet")}
          </span>
          <span className="block text-[11px] text-[var(--auth-text-muted)]">
            {t("fundingMode.walletHint")}
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={mode === "agency_bm"}
          disabled={!canAgencyBmFund}
          onClick={() => canAgencyBmFund && onChange("agency_bm")}
          className={cn(
            "min-h-11 rounded-lg px-4 py-2 text-left transition-[background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/30",
            mode === "agency_bm" ? "bg-white shadow-sm" : "hover:bg-white/70",
            !canAgencyBmFund && "cursor-not-allowed opacity-50",
          )}
        >
          <span className="block text-[13px] font-semibold text-[var(--auth-text)]">
            {t("fundingMode.bm")}
          </span>
          <span className="block text-[11px] text-[var(--auth-text-muted)]">
            {t("fundingMode.bmHint")}
          </span>
        </button>
      </div>
    </section>
  );
}
