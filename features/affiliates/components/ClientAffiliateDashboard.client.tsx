"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DashboardModalShell } from "@/components/ui/DashboardModalShell.client";
import {
  CLIENT_REFERRAL_STAGES,
  formatAffiliateUsd,
  referralInitials,
  type ClientAffiliateProgramView,
  type ClientAffiliateReferral,
  type ClientAffiliateTab,
  type ClientReferralStage,
} from "@/features/affiliates/lib/client-program";

const SCRIPT = { fontFamily: "var(--font-caveat), cursive" } as const;
const DATE_ZONE = "America/Lima";

const TABS: ClientAffiliateTab[] = ["referrals", "discounts", "how", "materials"];
const STEP_KEYS = ["share", "register", "contact", "close", "reward"] as const;

const AVATARS = [
  "bg-[#efe4ff] text-[#6d28d9]",
  "bg-[#ffe4ef] text-[#be185d]",
  "bg-[#e7f0ff] text-[#1d4ed8]",
  "bg-[#e8f8ef] text-[#047857]",
  "bg-[#fff1e4] text-[#c2410c]",
];

export function ClientAffiliateDashboard({
  program,
}: {
  program: ClientAffiliateProgramView;
}) {
  const t = useTranslations("affiliates.client");
  const locale = useLocale();
  const reward = formatAffiliateUsd(program.rewardUsd);
  const [tab, setTab] = useState<ClientAffiliateTab>("referrals");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<ClientReferralStage | "all">("all");
  const [copied, setCopied] = useState<"link" | "email" | "text" | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientAffiliateReferral | null>(null);

  const shareText = t("shareMessage", { url: program.shareUrl });
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return program.referrals.filter((row) => {
      if (stage !== "all" && row.stage !== stage) return false;
      if (!needle) return true;
      return [row.name, row.company, row.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [program.referrals, query, stage]);

  const discounts = program.referrals.filter((row) => row.earned);
  const showDeclined = program.referrals.some((row) => row.stage === "declined");

  useEffect(() => {
    if (!menuId) return;
    function close(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-referral-menu]")) return;
      setMenuId(null);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuId]);

  async function copyValue(value: string, kind: "link" | "email" | "text") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  function openDetail(row: ClientAffiliateReferral) {
    setMenuId(null);
    setDetail(row);
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.5rem] border border-[#f0e6df] bg-white shadow-[0_18px_40px_-32px_rgb(28_25_23_/_0.28)]">
        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
          <div className="px-6 py-7 sm:px-8 sm:py-8">
            {program.smoke ? (
              <div className="mb-3 max-w-xl">
                <p className="inline-flex rounded-full bg-[#fff6eb] px-3 py-1 text-xs font-semibold text-[#9a3412]">
                  {t("smoke")}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#9a3412]">{t("smokeHint")}</p>
              </div>
            ) : null}
            <h1 className="font-display text-[1.85rem] font-semibold leading-tight tracking-[-0.03em] text-[#1c1917] sm:text-[2.15rem]">
              {t("heroTitle")}
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#57534e]">
              {t("heroLead")}
            </p>
            <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#44403c]">
              {t.rich("heroOffer", {
                reward,
                amount: (chunks) => (
                  <span className="font-semibold text-[var(--brand-primary-deep)]">{chunks}</span>
                ),
                entry: (chunks) => (
                  <span className="font-semibold text-[#1c1917]">{chunks}</span>
                ),
              })}
            </p>
          </div>
          <div className="relative min-h-[210px] overflow-hidden bg-[radial-gradient(circle_at_70%_40%,#fff7f1_0%,#ffd7bf_42%,#f3b892_100%)] px-6 py-6">
            <p
              className="max-w-[230px] text-[1.85rem] leading-[1.05] text-[#3f342d]"
              style={{ ...SCRIPT, transform: "rotate(-4deg)" }}
            >
              {t("script")}
            </p>
            <div className="absolute bottom-5 right-5 w-[168px] rounded-2xl bg-white px-3.5 py-3 shadow-[0_16px_30px_-18px_rgb(120_53_15_/_0.55)]">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#fff1e6] text-[var(--brand-primary)]">
                  <GiftIcon />
                </span>
                <div>
                  <p className="text-lg font-bold leading-none text-[#1c1917]">
                    +{reward}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-[#78716c]">
                    {t("rewardCardHint")}
                  </p>
                </div>
              </div>
            </div>
            <span className="absolute bottom-6 left-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#1c1917] text-2xl font-bold text-white shadow-lg">
              H
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[#f0e6df] bg-white px-4 py-4 shadow-[0_16px_36px_-30px_rgb(28_25_23_/_0.3)] sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-sm font-semibold text-[#1c1917]">{t("linkLabel")}</p>
            <div className="flex items-center gap-2 rounded-xl border border-[#eadfd6] bg-[#fffdfb] px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-[#44403c]">
                {program.displayPath}
              </span>
              <button
                type="button"
                onClick={() => copyValue(program.shareUrl, "link")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#a8a29e] hover:bg-[#fff1e6] hover:text-[var(--brand-primary)]"
                aria-label={t("copy")}
              >
                <CopyIcon />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => copyValue(program.shareUrl, "link")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white shadow-[0_10px_20px_-12px_rgb(184_95_46_/_0.9)] transition hover:bg-[var(--brand-primary-deep)]"
          >
            <LinkIcon />
            {copied === "link" ? t("copied") : t("copy")}
          </button>
          <div className="lg:pl-2">
            <p className="mb-2 text-xs font-medium text-[#78716c]">{t("shareOn")}</p>
            <div className="flex items-center gap-2">
              <ShareButton
                href={whatsappHref(shareText)}
                label={t("shareWhatsapp")}
                className="bg-[#25d366] text-white"
              >
                <WhatsAppIcon />
              </ShareButton>
              <ShareButton
                href={telegramHref(program.shareUrl, shareText)}
                label={t("shareTelegram")}
                className="bg-[#2aa1df] text-white"
              >
                <TelegramIcon />
              </ShareButton>
              <ShareButton
                href={linkedinHref(program.shareUrl)}
                label={t("shareLinkedin")}
                className="bg-[#0a66c2] text-white"
              >
                <LinkedInIcon />
              </ShareButton>
              <ShareButton
                href={emailHref(t("shareSubject"), shareText)}
                label={t("shareEmail")}
                className="bg-[#fff1e6] text-[var(--brand-primary-deep)]"
              >
                <MailIcon />
              </ShareButton>
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t("statsTotal")} value={String(program.stats.total)} icon={<UsersIcon />} />
            <StatCard label={t("statsClosed")} value={String(program.stats.closed)} icon={<CheckIcon />} />
            <StatCard label={t("statsNegotiating")} value={String(program.stats.negotiating)} icon={<ClockIcon />} />
            <StatCard
              label={t("statsEarned")}
              value={formatAffiliateUsd(program.stats.discountsEarnedUsd)}
              icon={<GiftIcon />}
            />
          </div>

          <section className="overflow-hidden rounded-[1.25rem] border border-[#f0e6df] bg-white shadow-[0_16px_36px_-30px_rgb(28_25_23_/_0.28)]">
            <div className="flex gap-1 overflow-x-auto border-b border-[#f3ebe4] px-3">
              {TABS.map((key) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition ${
                      active
                        ? "border-[var(--brand-primary)] text-[var(--brand-primary-deep)]"
                        : "border-transparent text-[#78716c] hover:text-[#44403c]"
                    }`}
                  >
                    {t(`tabs.${key}`)}
                  </button>
                );
              })}
            </div>

            {tab === "referrals" ? (
              <div className="p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-base font-semibold text-[#1c1917]">
                    {t("listTitle", { count: program.referrals.length })}
                  </h2>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={stage}
                      onChange={(event) =>
                        setStage(event.target.value as ClientReferralStage | "all")
                      }
                      className="h-10 rounded-xl border border-[#eadfd6] bg-white px-3 text-sm text-[#44403c]"
                      aria-label={t("filterAll")}
                    >
                      <option value="all">{t("filterAll")}</option>
                      {CLIENT_REFERRAL_STAGES.filter(
                        (item) => item !== "declined" || showDeclined,
                      ).map((item) => (
                        <option key={item} value={item}>
                          {stageLabel(t, item)}
                        </option>
                      ))}
                    </select>
                    <label className="relative block">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]">
                        <SearchIcon />
                      </span>
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t("search")}
                        aria-label={t("searchAria")}
                        className="h-10 w-full rounded-xl border border-[#eadfd6] bg-white pr-3 pl-9 text-sm text-[#1c1917] outline-none placeholder:text-[#a8a29e] focus:border-[var(--brand-primary)] sm:w-64"
                      />
                    </label>
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <EmptyState
                    title={program.referrals.length === 0 ? t("emptyTitle") : t("emptyFilter")}
                    body={program.referrals.length === 0 ? t("emptyBody") : undefined}
                    action={
                      program.referrals.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setQuery("");
                            setStage("all");
                          }}
                          className="text-sm font-semibold text-[var(--brand-primary-deep)]"
                        >
                          {t("clearFilter")}
                        </button>
                      ) : null
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead>
                        <tr className="text-[11px] font-semibold tracking-wide text-[#a8a29e] uppercase">
                          <th className="px-2 py-2 font-semibold">{t("columns.index")}</th>
                          <th className="px-2 py-2 font-semibold">{t("columns.name")}</th>
                          <th className="px-2 py-2 font-semibold">{t("columns.date")}</th>
                          <th className="px-2 py-2 font-semibold">{t("columns.status")}</th>
                          <th className="px-2 py-2 font-semibold">{t("columns.benefit")}</th>
                          <th className="px-2 py-2 text-right font-semibold">{t("columns.actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((row, index) => (
                          <tr key={row.id} className="border-t border-[#f6efe9]">
                            <td className="px-2 py-3 text-[#a8a29e]">{index + 1}</td>
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${avatarClass(row.id)}`}
                                >
                                  {referralInitials(row.name)}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-[#1c1917]">{row.name}</p>
                                  {row.company && row.company !== row.name ? (
                                    <p className="truncate text-xs text-[#78716c]">{row.company}</p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3 whitespace-nowrap text-[#57534e]">
                              {formatReferralDate(row.registeredAt, locale)}
                            </td>
                            <td className="px-2 py-3">
                              <StagePill stage={row.stage} label={stageLabel(t, row.stage)} />
                            </td>
                            <td className="px-2 py-3 font-semibold whitespace-nowrap text-[#1c1917]">
                              <span className="inline-flex items-center gap-1">
                                {formatAffiliateUsd(row.benefitUsd)}
                                {row.earned ? (
                                  <span className="text-emerald-600" title={t("earnedMark")}>
                                    <CheckIcon />
                                  </span>
                                ) : null}
                              </span>
                            </td>
                            <td className="relative px-2 py-3 text-right" data-referral-menu>
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openDetail(row)}
                                  className="rounded-lg px-2 py-1 text-sm font-medium text-[#57534e] hover:bg-[#fff7f1] hover:text-[#1c1917]"
                                >
                                  {t("viewDetails")}
                                </button>
                                <button
                                  type="button"
                                  aria-label={t("moreActions")}
                                  aria-expanded={menuId === row.id}
                                  onClick={() =>
                                    setMenuId((current) => (current === row.id ? null : row.id))
                                  }
                                  className="grid h-8 w-8 place-items-center rounded-lg text-[#78716c] hover:bg-[#fff7f1]"
                                >
                                  <MoreIcon />
                                </button>
                              </div>
                              {menuId === row.id ? (
                                <div className="absolute right-2 z-20 mt-1 w-44 rounded-xl border border-[#f0e6df] bg-white p-1 text-left shadow-lg">
                                  <button
                                    type="button"
                                    onClick={() => openDetail(row)}
                                    className="block w-full rounded-lg px-3 py-2 text-sm text-[#44403c] hover:bg-[#fff7f1]"
                                  >
                                    {t("viewDetails")}
                                  </button>
                                  {row.email ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void copyValue(row.email ?? "", "email");
                                        setMenuId(null);
                                      }}
                                      className="block w-full rounded-lg px-3 py-2 text-sm text-[#44403c] hover:bg-[#fff7f1]"
                                    >
                                      {copied === "email" ? t("emailCopied") : t("copyEmail")}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}

            {tab === "discounts" ? (
              <div className="p-5 sm:p-6">
                <h2 className="text-base font-semibold text-[#1c1917]">{t("discountsTitle")}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[#78716c]">
                  {t("discountsLead", { reward })}
                </p>
                {discounts.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState title={t("discountsEmpty")} />
                  </div>
                ) : (
                  <ul className="mt-4 divide-y divide-[#f6efe9]">
                    {discounts.map((row) => (
                      <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div>
                          <p className="font-semibold text-[#1c1917]">{row.name}</p>
                          <p className="text-xs text-[#78716c]">
                            {row.discountStatus === "applied"
                              ? t("discountApplied")
                              : t("discountPending")}
                            {row.appliedAt
                              ? ` · ${formatReferralDate(row.appliedAt, locale)}`
                              : ""}
                          </p>
                        </div>
                        <p className="font-semibold text-[#1c1917]">
                          {formatAffiliateUsd(row.benefitUsd)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {tab === "how" ? (
              <div className="space-y-4 p-5 sm:p-6">
                {STEP_KEYS.map((key, index) => (
                  <div key={key} className="flex gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--brand-primary)] text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-[#1c1917]">{t(`steps.${key}.title`)}</p>
                      <p className="text-sm text-[#78716c]">{t(`steps.${key}.body`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === "materials" ? (
              <div className="space-y-4 p-5 sm:p-6">
                <div>
                  <h2 className="text-base font-semibold text-[#1c1917]">{t("materialsTitle")}</h2>
                  <p className="mt-1 text-sm leading-6 text-[#78716c]">{t("materialsLead")}</p>
                </div>
                <MaterialCard
                  title={t("materialsShort")}
                  body={t("materialsShortBody", { url: program.shareUrl })}
                  action={copied === "text" ? t("textCopied") : t("copyText")}
                  onCopy={() =>
                    copyValue(t("materialsShortBody", { url: program.shareUrl }), "text")
                  }
                />
                <MaterialCard
                  title={t("materialsPost")}
                  body={t("materialsPostBody", { url: program.shareUrl, reward })}
                  action={copied === "text" ? t("textCopied") : t("copyText")}
                  onCopy={() =>
                    copyValue(
                      t("materialsPostBody", { url: program.shareUrl, reward }),
                      "text",
                    )
                  }
                />
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[1.25rem] border border-[#f0e6df] bg-white p-5 shadow-[0_16px_36px_-30px_rgb(28_25_23_/_0.28)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#fff1e6] text-[var(--brand-primary)]">
                <GiftIcon />
              </span>
              <h2 className="text-sm font-semibold text-[#1c1917]">{t("benefitTitle")}</h2>
            </div>
            <p className="text-sm leading-6 text-[#44403c]">
              {t("benefitLead", { reward })}
            </p>
            <ul className="mt-4 space-y-3">
              <BenefitItem>{t("benefitEntry")}</BenefitItem>
              <BenefitItem>{t("benefitInvoice")}</BenefitItem>
            </ul>
          </section>

          <section className="rounded-[1.25rem] border border-[#f0e6df] bg-white p-5 shadow-[0_16px_36px_-30px_rgb(28_25_23_/_0.28)]">
            <h2 className="mb-4 text-sm font-semibold text-[#1c1917]">{t("howTitle")}</h2>
            <ol className="space-y-4">
              {STEP_KEYS.map((key, index) => (
                <li key={key} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--brand-primary)] text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1c1917]">
                      {t(`steps.${key}.title`)}
                    </p>
                    <p className="text-xs leading-5 text-[#78716c]">{t(`steps.${key}.body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <section className="flex flex-col gap-4 overflow-hidden rounded-[1.25rem] bg-[linear-gradient(90deg,#fff7f1_0%,#ffe7d4_55%,#ffd7bf_100%)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[var(--brand-primary)] shadow-sm">
            <TrophyIcon />
          </span>
          <div>
            <p className="font-semibold text-[#1c1917]">{t("footerTitle")}</p>
            <p className="text-sm text-[#78716c]">{t("footerBody")}</p>
          </div>
        </div>
        <p
          className="text-right text-[1.7rem] leading-none text-[#7c2d12]"
          style={{ ...SCRIPT, transform: "rotate(-3deg)" }}
        >
          {t("footerScriptA")}
          <br />
          {t("footerScriptB")}
        </p>
      </section>

      <DashboardModalShell
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        maxWidthClassName="max-w-md"
      >
        {detail ? (
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#a8a29e] uppercase">
                  {t("detailTitle")}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#1c1917]">{detail.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-lg px-2 py-1 text-sm text-[#78716c] hover:bg-[#fff7f1]"
              >
                {t("detailClose")}
              </button>
            </div>
            {program.smoke ? (
              <p className="mt-3 rounded-xl bg-[#fff6eb] px-3 py-2 text-xs leading-5 text-[#9a3412]">
                {t("detailSmoke")}
              </p>
            ) : null}
            <dl className="mt-4 space-y-3 text-sm">
              <DetailRow label={t("detailCompany")} value={detail.company ?? "—"} />
              <DetailRow label={t("detailEmail")} value={detail.email ?? "—"} />
              <DetailRow
                label={t("detailRegistered")}
                value={formatReferralDate(detail.registeredAt, locale)}
              />
              <DetailRow label={t("detailStatus")} value={stageLabel(t, detail.stage)} />
              <DetailRow
                label={t("detailBenefit")}
                value={formatAffiliateUsd(detail.benefitUsd)}
              />
            </dl>
            <p className="mt-4 text-xs font-semibold tracking-wide text-[#a8a29e] uppercase">
              {t("detailNext")}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#44403c]">
              {nextCopy(t, detail.stage)}
            </p>
          </div>
        ) : null}
      </DashboardModalShell>
    </div>
  );
}

function stageLabel(
  t: ReturnType<typeof useTranslations<"affiliates.client">>,
  stage: ClientReferralStage,
) {
  switch (stage) {
    case "registered":
      return t("stages.registered");
    case "negotiating":
      return t("stages.negotiating");
    case "contract_sent":
      return t("stages.contract_sent");
    case "closed":
      return t("stages.closed");
    case "declined":
      return t("stages.declined");
  }
}

function nextCopy(
  t: ReturnType<typeof useTranslations<"affiliates.client">>,
  stage: ClientReferralStage,
) {
  switch (stage) {
    case "registered":
      return t("next.registered");
    case "negotiating":
      return t("next.negotiating");
    case "contract_sent":
      return t("next.contract_sent");
    case "closed":
      return t("next.closed");
    case "declined":
      return t("next.declined");
  }
}

function formatReferralDate(iso: string, locale: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: DATE_ZONE,
  }).format(date);
}

function avatarClass(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash + char.charCodeAt(0)) % AVATARS.length;
  return AVATARS[hash] ?? AVATARS[0];
}

function whatsappHref(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function telegramHref(url: string, text: string) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

function linkedinHref(url: string) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

function emailHref(subject: string, body: string) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-[#f0e6df] bg-white px-4 py-3.5 shadow-[0_12px_28px_-24px_rgb(28_25_23_/_0.35)]">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff1e6] text-[var(--brand-primary)]">
        {icon}
      </span>
      <div>
        <p className="text-xl font-bold tracking-tight text-[#1c1917]">{value}</p>
        <p className="text-xs text-[#78716c]">{label}</p>
      </div>
    </article>
  );
}

function BenefitItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2 text-sm leading-5 text-[#44403c]">
      <span className="mt-0.5 text-emerald-600">
        <CheckIcon />
      </span>
      <span>{children}</span>
    </li>
  );
}

function StagePill({ stage, label }: { stage: ClientReferralStage; label: string }) {
  const tone =
    stage === "closed"
      ? "bg-emerald-50 text-emerald-700"
      : stage === "negotiating"
        ? "bg-amber-50 text-amber-700"
        : stage === "contract_sent"
          ? "bg-sky-50 text-sky-700"
          : stage === "declined"
            ? "bg-rose-50 text-rose-700"
            : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      <StageMark stage={stage} />
      {label}
    </span>
  );
}

function StageMark({ stage }: { stage: ClientReferralStage }) {
  if (stage === "closed") return <CheckIcon />;
  if (stage === "negotiating") return <ClockIcon />;
  if (stage === "contract_sent") return <SendIcon />;
  return <DotIcon />;
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#eadfd6] bg-[#fffdfb] px-4 py-8 text-center">
      <p className="font-semibold text-[#1c1917]">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-md text-sm text-[#78716c]">{body}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function MaterialCard({
  title,
  body,
  action,
  onCopy,
}: {
  title: string;
  body: string;
  action: string;
  onCopy: () => void;
}) {
  return (
    <article className="rounded-2xl border border-[#f0e6df] bg-[#fffdfb] p-4">
      <p className="text-sm font-semibold text-[#1c1917]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#57534e]">{body}</p>
      <button
        type="button"
        onClick={onCopy}
        className="mt-3 text-sm font-semibold text-[var(--brand-primary-deep)]"
      >
        {action}
      </button>
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[#78716c]">{label}</dt>
      <dd className="text-right font-medium text-[#1c1917]">{value}</dd>
    </div>
  );
}

function ShareButton({
  href,
  label,
  className,
  children,
}: {
  href: string;
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-xl ${className}`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </a>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 19v-1.2A3.8 3.8 0 0 0 12.2 14H7.8A3.8 3.8 0 0 0 4 17.8V19" strokeLinecap="round" />
      <circle cx="10" cy="8" r="3" />
      <path d="M20 19v-1.1A3.2 3.2 0 0 0 17.2 15" strokeLinecap="round" />
      <path d="M16.2 5.2a2.6 2.6 0 0 1 0 5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M5 12.5 9.2 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5L15 15" strokeLinecap="round" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="10" width="16" height="9" rx="1.5" />
      <path d="M4 14h16M12 10v9M12 10c-2.5 0-4-2.8-2.4-4.2C11.2 4.4 12 7 12 10Zm0 0c2.5 0 4-2.8 2.4-4.2C12.8 4.4 12 7 12 10Z" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 14a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" strokeLinecap="round" />
      <path d="M14 10a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m4 12 16-7-7 16-2-7-7-2Z" strokeLinejoin="round" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M9 18h6M12 14v4" strokeLinecap="round" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 4.5A7.46 7.46 0 0 0 5.6 15.9L4.5 19.5l3.7-1.05A7.5 7.5 0 1 0 12.04 4.5Zm4.24 10.62c-.18.5-1.04.96-1.45 1.02-.37.06-.84.08-1.36-.08-.31-.1-.72-.23-1.24-.46-2.18-.94-3.6-3.14-3.71-3.29-.11-.14-.89-1.18-.89-2.25s.56-1.6.76-1.82c.2-.22.43-.27.58-.27h.41c.13 0 .31-.05.48.37.18.43.6 1.48.65 1.59.06.11.09.24.02.38-.08.14-.12.23-.23.35-.12.12-.24.27-.35.36-.11.1-.23.22-.1.43.14.2.6.99 1.29 1.6.89.79 1.64 1.04 1.87 1.15.23.12.37.1.5-.06.14-.16.58-.67.74-.9.15-.23.31-.19.52-.11.22.08 1.36.64 1.6.76.23.12.39.18.44.28.06.1.06.58-.12 1.08Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.8 5.4 4.9 11.1c-1 .4-1 .97-.2 1.22l3.82 1.19 1.47 4.5c.18.5.09.7.62.7.32 0 .46-.15.64-.33l2.05-2 4.26 3.15c.78.43 1.34.21 1.53-.73l2.77-13.1c.28-1.14-.44-1.66-1.16-1.3Zm-2.3 3.02-7.2 6.55-.28 2.95-1.1-3.66 8.58-5.84Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.5 9.5H4V20h2.5V9.5ZM5.24 4A1.46 1.46 0 1 0 5.26 7a1.46 1.46 0 0 0-.02-3ZM20 20h-2.5v-5.6c0-1.55-.56-2.6-1.95-2.6-1.06 0-1.7.72-1.98 1.41-.1.25-.13.6-.13.95V20H11V9.5h2.4v1.44c.36-.58 1.14-1.64 2.86-1.64 2.09 0 3.74 1.37 3.74 4.32V20Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" />
    </svg>
  );
}
