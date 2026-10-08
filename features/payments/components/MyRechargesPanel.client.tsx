"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import { formatPenAmount } from "@/lib/payments/manual-deposit.shared";
import { ManualPaymentModal } from "@/features/payments/components/ManualPaymentModal.client";
import type { RechargeRow, RechargeState } from "@/lib/payments/my-recharges.shared";

const TONE: Record<RechargeState, string> = {
  credited: "bg-[#eaf5ee] text-[#2f6b47]",
  in_review: "bg-[#eef3fb] text-[#2f5596]",
  needs_proof: "bg-[#fff4e5] text-[#9a5a12]",
  pay_yape: "bg-[#f4eefb] text-[#6b3fa0]",
  pay_crypto: "bg-[#fff4e5] text-[#9a5a12]",
  processing: "bg-[#f3eee8] text-[#5c564e]",
  replaced: "bg-[#f3eee8] text-[#8a8177]",
  cancelled: "bg-[#f3eee8] text-[#8a8177]",
  failed: "bg-[#fdf0f0] text-[#a23b3b]",
};

type ProviderKey = "providerManual" | "providerYape" | "providerCrypto" | "providerCard" | "providerOther";
const PROVIDER_KEY: Record<string, ProviderKey> = {
  manual: "providerManual",
  cobrana: "providerYape",
  crypto: "providerCrypto",
  stripe: "providerCard",
};

export function MyRechargesPanel({ rows, feePercent }: { rows: RechargeRow[]; feePercent: number }) {
  const t = useTranslations("payments.myRecharges");
  const { formatMoney, bcp47 } = useAppFormatter();
  const [resume, setResume] = useState<RechargeRow | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (rows.length === 0) return null;
  const pending = rows.filter((r) => r.state === "needs_proof" || r.state === "pay_yape" || r.state === "pay_crypto").length;
  const charge = (r: RechargeRow) =>
    r.chargeCurrency === "PEN" ? formatPenAmount(r.chargeCents) : formatMoney(r.chargeCents / 100);
  const when = (iso: string) =>
    new Intl.DateTimeFormat(bcp47, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      window.prompt(t("copyPrompt"), value);
    }
  }

  return (
    <section id="mis-recargas" className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#e8dfd4]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1a1714]">{t("title")}</h2>
          <p className="mt-0.5 text-[12px] text-[#5c564e]">{t("subtitle")}</p>
        </div>
        {pending > 0 ? (
          <span className="rounded-full bg-[#fff4e5] px-2.5 py-1 text-[11px] font-semibold text-[#9a5a12]">
            {t("pendingCount", { count: pending })}
          </span>
        ) : null}
      </div>
      <ul className="px-4 pb-3 sm:px-5">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 border-t border-[#f1ebe4] py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[row.state]}`}>
                  {t(`state.${row.state}`)}
                </span>
                <span className="text-[13.5px] font-semibold tabular-nums text-[#1a1714]">{charge(row)}</span>
                {row.creditUsdCents != null && row.state !== "replaced" && row.state !== "cancelled" ? (
                  <span className="text-[12px] text-[#8a8177]">
                    {t("credit", { amount: formatMoney(row.creditUsdCents / 100) })}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[11.5px] text-[#8a8177]">
                {[t(PROVIDER_KEY[row.provider] ?? "providerOther"), when(row.createdAt)].join(" · ")}
              </p>
              <p className="mt-0.5 text-[12px] leading-5 text-[#5c564e]">
                {row.note ??
                  (row.cryptoMissingUsdt != null
                    ? t("hint.pay_crypto_short", { amount: row.cryptoMissingUsdt.toFixed(2) })
                    : t(`hint.${row.state}`))}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {row.state === "needs_proof" && row.provider === "manual" ? (
                <button
                  type="button"
                  onClick={() => setResume(row)}
                  className="inline-flex h-9 items-center rounded-full bg-[#c46d3c] px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-[#b0602f]"
                >
                  {t("uploadProof")}
                </button>
              ) : null}
              {row.state === "pay_yape" && row.yapeCode ? (
                <button
                  type="button"
                  onClick={() => void copy(row.yapeCode as string)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[12.5px] font-semibold text-[#1a1714] ring-1 ring-[#e8dfd4] transition hover:bg-[#faf8f5]"
                >
                  <span className="font-mono text-[12px]">{row.yapeCode}</span>
                  <span className="text-[#8a8177]">{copied === row.yapeCode ? t("copied") : t("copy")}</span>
                </button>
              ) : null}
              {row.state === "pay_crypto" && row.checkoutUrl ? (
                <a
                  href={row.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-full bg-white px-3.5 text-[12.5px] font-semibold text-[#1a1714] ring-1 ring-[#e8dfd4] transition hover:bg-[#faf8f5]"
                >
                  {t("payCrypto")}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {resume ? (
        <ManualPaymentModal
          key={resume.id}
          open
          onClose={() => setResume(null)}
          feePercent={feePercent}
          resume={{ paymentIntentId: resume.id, chargeCents: resume.chargeCents, chargeCurrency: resume.chargeCurrency }}
        />
      ) : null}
    </section>
  );
}
