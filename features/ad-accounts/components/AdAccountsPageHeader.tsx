import { getTranslations } from "next-intl/server";
import { routes } from "@/config/routes";
import { getAppFormatter } from "@/lib/i18n/get-app-formatter";
import {
  CrmAsideStat,
  CrmHeroButton,
  CrmMetricRow,
  CrmScopeHero,
} from "@/components/dashboard/crm-ui";
import { AdAccountsOpenCreateModalButton } from "./AdAccountsOpenCreateModalButton.client";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsPageHeaderProps {
  summary: AdAccountsSummary;
  hecomScoped?: boolean;
  clienteName?: string;
  clienteId?: string;
  avatarUrl?: string | null;
  hideCreate?: boolean;
  enableTikTokCreate?: boolean;
}

function accountStatusHint(
  summary: AdAccountsSummary,
  t: Awaited<ReturnType<typeof getTranslations>>,
  formatNumber: (value: number) => string,
) {
  const total = summary.totalAccounts;
  const active = summary.activeAccounts;
  const suspended = summary.disabledAccounts ?? 0;
  const pending = summary.pendingSetup ?? 0;

  if (total === 0) return t("header.noMapped");
  if (suspended === 0 && pending === 0 && active === total) {
    return t("header.allInCampaign");
  }

  const parts: string[] = [];
  if (active > 0) {
    parts.push(
      t(active === 1 ? "header.activeOne" : "header.activeMany", {
        count: formatNumber(active),
      }),
    );
  }
  if (suspended > 0) {
    parts.push(
      t(suspended === 1 ? "header.suspendedOne" : "header.suspendedMany", {
        count: formatNumber(suspended),
      }),
    );
  }
  if (pending > 0) {
    parts.push(
      t(pending === 1 ? "header.pendingOne" : "header.pendingMany", {
        count: formatNumber(pending),
      }),
    );
  }
  return parts.join(" · ");
}

export async function AdAccountsPageHeader({
  summary,
  hecomScoped = false,
  clienteName,
  avatarUrl,
  hideCreate = false,
  enableTikTokCreate = false,
}: AdAccountsPageHeaderProps) {
  const t = await getTranslations("adAccounts");
  const { formatMoney, formatNumber } = await getAppFormatter();
  const suspended = summary.disabledAccounts ?? 0;
  const pending = summary.pendingSetup ?? 0;
  const statusHint = accountStatusHint(summary, t, formatNumber);

  const metricItems: Array<{
    label: string;
    value: string;
    hint?: string;
    emphasis?: "primary" | "default" | "muted";
  }> = [
    {
      label: t("header.tiktokAccounts"),
      value: formatNumber(summary.totalAccounts),
      hint: statusHint,
      emphasis: "primary",
    },
  ];

  if (suspended > 0) {
    metricItems.push({
      label: t("header.suspended"),
      value: formatNumber(suspended),
      hint: t("header.suspendedHint"),
      emphasis: "muted",
    });
  }

  if (pending > 0) {
    metricItems.push({
      label: t("header.pending"),
      value: formatNumber(pending),
      hint: t("header.pendingHint"),
      emphasis: "muted",
    });
  }

  return (
    <div className="space-y-4">
      <CrmScopeHero
        module={t("header.module")}
        title={t("header.pageTitle")}
        cliente={
          hecomScoped && clienteName
            ? { name: clienteName, avatarUrl }
            : undefined
        }
        meta={
          hecomScoped
            ? enableTikTokCreate
              ? t("header.metaScopedCreate")
              : t("header.metaScoped")
            : t("header.metaPick")
        }
        actions={
          <>
            <CrmHeroButton href={routes.payments}>
              {t("header.goPayments")}
            </CrmHeroButton>
            <CrmHeroButton href={routes.overview} variant="secondary">
              {t("header.goOverview")}
            </CrmHeroButton>
            {hideCreate && !enableTikTokCreate ? null : (
              <AdAccountsOpenCreateModalButton className="inline-flex h-10 items-center rounded-lg border border-[var(--auth-border)] bg-white px-4 text-[13px] font-semibold text-[var(--auth-text)]">
                {enableTikTokCreate
                  ? t("header.createTikTok")
                  : t("header.create")}
              </AdAccountsOpenCreateModalButton>
            )}
          </>
        }
        aside={
          <CrmAsideStat
            label={t("header.assignedBalance")}
            value={formatMoney(summary.assignedBalance)}
            detail={statusHint}
          />
        }
      />

      <CrmMetricRow items={metricItems} />
    </div>
  );
}
