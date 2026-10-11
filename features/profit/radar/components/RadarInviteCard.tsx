"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";

/** Invitación al Radar en Profit, mientras el cliente no haya armado su perfil. */
export function RadarInviteCard() {
  const t = useTranslations("profit.radar.invite");
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#ece7e0] bg-white px-5 py-4 sm:px-6">
      <div className="min-w-0 max-w-[60ch]">
        <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-[#1c1917]">{t("title")}</h2>
        <p className="mt-1 text-[13.5px] leading-[1.55] text-[#5c564e]">{t("body")}</p>
      </div>
      <Link
        href={`${routes.profit}/radar`}
        className="inline-flex h-10 shrink-0 items-center rounded-[12px] bg-[#17150f] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#2b2620] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]/60 focus-visible:ring-offset-2"
      >
        {t("cta")}
      </Link>
    </section>
  );
}
