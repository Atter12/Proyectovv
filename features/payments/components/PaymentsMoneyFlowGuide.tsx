"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PaymentGatewayId } from "@/types/payment";

/**
 * Guía de recarga: pasos según el método, cuánto tarda y las preguntas que
 * más llegan a soporte. Abre en el método que el cliente tiene elegido.
 */
type GuideTab = "yape" | "manual" | "crypto" | "abroad";

const STEPS: Record<GuideTab, number> = { yape: 3, manual: 4, crypto: 4, abroad: 3 };
const FAQ = ["notCredited", "invalidPayment", "card", "fee", "assign"] as const;

function tabFromGateway(id: PaymentGatewayId | undefined): GuideTab {
  if (id === "manual") return "manual";
  if (id === "crypto") return "crypto";
  return "yape";
}

export function PaymentsMoneyFlowGuide({
  selected,
  feePercent = 10,
}: {
  selected?: PaymentGatewayId;
  feePercent?: number;
}) {
  const t = useTranslations("payments.guide");
  const [picked, setPicked] = useState<GuideTab | null>(null);
  const tab = picked ?? tabFromGateway(selected);

  return (
    <details className="group mt-3">
      <summary className="-ml-2 inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-[var(--auth-accent)] outline-none transition-colors hover:bg-[var(--auth-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/30 [&::-webkit-details-marker]:hidden">
        <InfoIcon />
        <span>{t("summary")}</span>
        <ChevronIcon />
      </summary>

      <div className="mt-2 overflow-hidden rounded-[18px] bg-[#faf8f5] ring-1 ring-[#ece4da]">
        <p className="px-4 pt-3.5 text-[12.5px] leading-5 text-[#5c564e] sm:px-5">{t("intro")}</p>

        <div role="tablist" aria-label={t("tabsLabel")} className="flex flex-wrap gap-1.5 px-4 pb-1 pt-3 sm:px-5">
          {(["yape", "manual", "crypto", "abroad"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setPicked(id)}
              className={`inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12px] font-semibold transition ${
                tab === id ? "bg-[#1a1714] text-white" : "bg-white text-[#5c564e] ring-1 ring-[#e8dfd4] hover:text-[#1a1714]"
              }`}
            >
              {t(`tabs.${id}`)}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="px-4 pb-4 pt-3 sm:px-5">
          <ol className="space-y-2.5">
            {Array.from({ length: STEPS[tab] }, (_, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e2a074] text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-[13px] leading-5 text-[#1a1714]">
                  {t(`${tab}.step${i + 1}` as Parameters<typeof t>[0], { fee: feePercent })}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-[#2f6b47] ring-1 ring-[#d7ebdd]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3f9a62]" aria-hidden />
            {t(`${tab}.time`)}
          </p>
          <p className="mt-2 text-[12px] leading-5 text-[#8a8177]">{t(`${tab}.tip`)}</p>
        </div>

        <div className="border-t border-[#ece4da] px-4 py-3 sm:px-5">
          <p className="text-[12px] font-semibold text-[#5c564e]">{t("faqTitle")}</p>
          <div className="mt-1.5 divide-y divide-[#ece4da]">
            {FAQ.map((id) => (
              <details key={id} className="group/faq py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-medium text-[#1a1714] [&::-webkit-details-marker]:hidden">
                  {t(`faq.${id}.q`, { fee: feePercent })}
                  <span aria-hidden className="text-[#a89c90] transition group-open/faq:rotate-180">⌄</span>
                </summary>
                <p className="mt-1.5 text-[12.5px] leading-5 text-[#5c564e]">{t(`faq.${id}.a`, { fee: feePercent })}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 10.75v5" />
      <circle cx="12" cy="7.6" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="m6.5 8 3.5 3.5L13.5 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
