"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import type { AdAccount } from "@/types/ad-account";

/** Guía autoservicio cuando TikTok tiene la cuenta castigada/suspendida. */
export function SuspendedAccountHelp({ account }: { account: AdAccount }) {
  const t = useTranslations("adAccounts.suspendedHelp");
  const [openAppeal, setOpenAppeal] = useState(false);

  if (account.status !== "disabled") return null;

  const reason =
    account.tiktokRejectionReason?.trim() || t("noReason");
  const hasAlternative = Boolean(account.alternativeAccountId);
  const supportHref = `${routes.support}?topic=suspended&advertiser=${encodeURIComponent(account.externalAccountId ?? "")}`;

  return (
    <div className="mt-2 rounded-lg border border-[#f0c4c4] bg-[#fdf6f5] px-3 py-2.5 text-[12px] leading-5 text-[#5c3a3a]">
      <p className="font-semibold text-[#9b2c2c]">{t("title")}</p>
      <p className="mt-1 text-[#6b3f3f]">
        <span className="font-medium text-[#1a1612]">{t("reasonLabel")}: </span>
        {reason}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpenAppeal((v) => !v)}
          className="inline-flex h-8 items-center rounded-md border border-[#e8b4b4] bg-white px-2.5 text-[11px] font-semibold text-[#9b2c2c] transition hover:bg-[#fff8f7]"
        >
          {openAppeal ? t("hideAppeal") : t("showAppeal")}
        </button>
        {hasAlternative ? (
          <Link
            href={routes.payments}
            className="inline-flex h-8 items-center rounded-md border border-[#ffd7b8] bg-[#fff7f0] px-2.5 text-[11px] font-semibold text-[#c45a18] transition hover:bg-[#fff1e8]"
          >
            {t("useAlternative")}
          </Link>
        ) : (
          <Link
            href={supportHref}
            className="inline-flex h-8 items-center rounded-md border border-[#e8b4b4] bg-white px-2.5 text-[11px] font-semibold text-[#9b2c2c] transition hover:bg-[#fff8f7]"
          >
            {t("askSupport")}
          </Link>
        )}
      </div>

      {hasAlternative && account.alternativeAccountName ? (
        <p className="mt-2 text-[11px] text-[#7a5a5a]">
          {t("alternativeHint", { name: account.alternativeAccountName })}
        </p>
      ) : null}

      {openAppeal ? (
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-[#5c3a3a]">
          <li>{t("step1")}</li>
          <li>{t("step2")}</li>
          <li>{t("step3")}</li>
          <li>{t("step4")}</li>
          <li>{t("step5")}</li>
        </ol>
      ) : null}

      <p className="mt-2 text-[10px] leading-4 text-[#9a7a7a]">{t("disclaimer")}</p>
    </div>
  );
}
