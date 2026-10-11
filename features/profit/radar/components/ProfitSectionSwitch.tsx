"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";

/** Selector entre las dos vistas de Profit. El Radar vive dentro de Profit, sin sección nueva en el menú. */
export function ProfitSectionSwitch({ active }: { active: "analysis" | "radar" }) {
  const t = useTranslations("profit.radar.switch");
  const items = [
    { key: "analysis" as const, href: routes.profit, label: t("analysis") },
    { key: "radar" as const, href: `${routes.profit}/radar`, label: t("radar") },
  ];
  return (
    <nav aria-label={t("label")} className="inline-flex rounded-[12px] border border-[#ece7e0] bg-[#f5f2ed] p-1">
      {items.map((item) => {
        const on = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-[9px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]/60 ${
              on ? "bg-white text-[#1c1917] shadow-[0_1px_2px_rgb(28_25_23/0.08)]" : "text-[#5c564e] hover:text-[#1c1917]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
