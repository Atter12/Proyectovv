import { getTranslations } from "next-intl/server";
import { routes } from "@/config/routes";
import {
  CrmHeroButton,
  CrmMetricCell,
  CrmMetricsStrip,
  CrmQuickLinks,
  CrmScopeHero,
} from "@/components/dashboard/crm-ui";
import type { HecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";

export async function ClienteScopedAffiliates({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const t = await getTranslations("affiliates");
  const { cliente } = data;

  return (
    <div className="space-y-5 sm:space-y-6">
      <CrmScopeHero
        module={t("module")}
        title={t("title")}
        cliente={{ name: cliente.name, avatarUrl: cliente.avatarUrl }}
        meta={t("meta")}
        actions={
          <>
            <CrmHeroButton href={routes.payments}>{t("goPayments")}</CrmHeroButton>
            <CrmHeroButton href={routes.adAccounts} variant="secondary">
              {t("viewAccounts")}
            </CrmHeroButton>
          </>
        }
      />

      <CrmMetricsStrip>
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:divide-x sm:divide-[var(--auth-divider)]">
          <CrmMetricCell
            label={t("referrals")}
            value="—"
            hint={t("notPerClient")}
            emphasis="muted"
          />
          <CrmMetricCell
            label={t("scope")}
            value={t("org")}
            hint={t("agencyProgram")}
            emphasis="muted"
          />
          <CrmMetricCell
            label={t("activeContext")}
            value={cliente.name.split(" ")[0] ?? cliente.name}
            hint={t("clientFilter")}
          />
        </div>
      </CrmMetricsStrip>

      <CrmQuickLinks
        links={[
          { href: routes.payments, label: t("quickPayments") },
          { href: routes.adAccounts, label: t("quickAccounts") },
          { href: routes.creativeAnalyzer, label: t("quickCreatives") },
        ]}
      />
    </div>
  );
}
