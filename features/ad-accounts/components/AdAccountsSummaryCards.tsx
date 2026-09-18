import { getTranslations } from "next-intl/server";
import { getAppFormatter } from "@/lib/i18n/get-app-formatter";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsSummaryCardsProps {
  summary: AdAccountsSummary;
}

export async function AdAccountsSummaryCards({
  summary,
}: AdAccountsSummaryCardsProps) {
  const t = await getTranslations("adAccounts");
  const { formatMoney, formatNumber } = await getAppFormatter();

  const items = [
    {
      label: t("summary.total"),
      value: formatNumber(summary.totalAccounts),
      hint: t("summary.totalHint"),
      accent: "bg-[#8a8178]",
      valueClass: "text-[#1a1612]",
    },
    {
      label: t("summary.active"),
      value: formatNumber(summary.activeAccounts),
      hint: t("summary.activeHint"),
      accent: "bg-[#2f7a57]",
      valueClass: "text-[#1f5c40]",
    },
    {
      label: t("summary.assigned"),
      value: formatMoney(summary.assignedBalance),
      hint: t("summary.assignedHint"),
      accent: "bg-[#c45a18]",
      valueClass: "text-[#1a1612]",
    },
  ];

  return (
    <section
      aria-label={t("summary.aria")}
      className="overflow-hidden rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]"
    >
      <div className="grid divide-y divide-[rgb(20_18_16_/_0.06)] sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-[rgb(20_18_16_/_0.06)]">
        {items.map((item) => (
          <div key={item.label} className="relative px-4 py-4 sm:px-5">
            <span
              aria-hidden
              className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${item.accent}`}
            />
            <p className="pl-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[#7a736a]">
              {item.label}
            </p>
            <p
              className={`mt-1.5 truncate pl-2 text-[1.25rem] font-medium tracking-[-0.01em] tabular-nums sm:text-[1.35rem] ${item.valueClass}`}
            >
              {item.value}
            </p>
            <p className="mt-1 pl-2 text-[12px] leading-5 text-[#8a8178]">
              {item.hint}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
