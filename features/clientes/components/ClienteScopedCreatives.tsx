import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { routes } from "@/config/routes";
import {
  CrmHeroButton,
  CrmMetricCell,
  CrmMetricsStrip,
  CrmPanel,
  CrmQuickLinks,
  CrmScopeHero,
} from "@/components/dashboard/crm-ui";
import { CopyTextButton } from "@/features/creative-analyzer/components/CopyTextButton.client";
import { CreativeUploadPanel } from "@/features/creative-analyzer/components/CreativeUploadPanel.client";
import { CreativeAssetsPanel } from "@/features/creative-analyzer/components/CreativeAssetsPanel.client";
import { AgentProDraftsPanel } from "@/features/creative-analyzer/components/AgentProDraftsPanel.client";
import { CreativePipelineStrip } from "@/features/creative-analyzer/components/CreativePipelineStrip.client";
import type {
  HecomClienteDashboard,
  HecomCreativoCliente,
  HecomCreativoProyecto,
} from "@/lib/hecom/cliente-dashboard.server";
import type {
  CreativeAccountOption,
  CreativeAssetListItem,
  CreativeDraftListItem,
} from "@/lib/creatives/types";

function platformLabel(platform: string | null) {
  if (!platform) return null;
  const p = platform.toLowerCase();
  if (p.includes("tiktok")) return "TikTok";
  if (p.includes("meta") || p.includes("facebook") || p.includes("ig"))
    return "Meta";
  if (p.includes("google") || p.includes("youtube")) return "Google";
  return platform;
}

function resolveActiveStep(input: {
  assets: CreativeAssetListItem[];
  drafts: CreativeDraftListItem[];
}): 0 | 1 | 2 | 3 {
  const hasUpload = input.assets.length > 0;
  const hasScore = input.assets.some((a) => a.insight);
  const hasDraft = input.drafts.length > 0;
  const hasLaunch = input.drafts.some(
    (d) =>
      d.status === "approved" ||
      d.status === "published" ||
      d.status === "publishing",
  );
  if (hasLaunch) return 3;
  if (hasDraft) return 2;
  if (hasScore) return 1;
  if (hasUpload) return 1;
  return 0;
}

export async function ClienteScopedCreatives({
  data,
  accounts,
  assets,
  drafts,
  publishEnabled,
}: {
  data: HecomClienteDashboard;
  accounts: CreativeAccountOption[];
  assets: CreativeAssetListItem[];
  drafts: CreativeDraftListItem[];
  publishEnabled: boolean;
}) {
  const t = await getTranslations("creatives");
  const { cliente, creativosClientes, creativosProyectos, summary } = data;
  const published = creativosProyectos.filter((p) => p.published === true).length;
  const analyzed = assets.filter((a) => a.insight).length;
  const pendingDrafts = drafts.filter(
    (d) => d.status === "draft" || d.status === "failed",
  ).length;
  const activeStep = resolveActiveStep({ assets, drafts });
  const avgScore =
    analyzed > 0
      ? Math.round(
          assets
            .filter((a) => a.insight)
            .reduce((sum, a) => sum + (a.insight?.overallScore ?? 0), 0) /
            analyzed,
        )
      : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <CrmScopeHero
        module={t("module")}
        title={t("title")}
        cliente={{ name: cliente.name, avatarUrl: cliente.avatarUrl }}
        meta={t("meta", { count: analyzed })}
        actions={
          <>
            <CrmHeroButton href="#creative-upload">
              {t("uploadVideo")}
            </CrmHeroButton>
            <CrmHeroButton href={routes.adAccounts} variant="secondary">
              {t("tiktokAccounts")}
            </CrmHeroButton>
          </>
        }
      />

      <CreativePipelineStrip activeStep={activeStep} />

      <CrmMetricsStrip>
        <div className="grid grid-cols-2 sm:flex sm:divide-x sm:divide-[var(--auth-divider)] lg:grid-cols-4">
          <CrmMetricCell
            label={t("metrics.uploads")}
            value={String(assets.length)}
            emphasis="primary"
          />
          <CrmMetricCell
            label={t("metrics.scoreAvg")}
            value={avgScore != null ? String(avgScore) : "—"}
          />
          <CrmMetricCell
            label={t("metrics.pendingApprove")}
            value={String(pendingDrafts)}
          />
          <CrmMetricCell
            label={t("metrics.hecom")}
            value={String(summary.projectCount + published)}
            emphasis="muted"
          />
        </div>
      </CrmMetricsStrip>

      <CreativeUploadPanel
        clienteName={cliente.name}
        accounts={accounts}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <CreativeAssetsPanel assets={assets} />
        <AgentProDraftsPanel
          drafts={drafts}
          publishEnabled={publishEnabled}
        />
      </div>

      <CrmQuickLinks
        links={[
          { href: routes.overview, label: t("quickLinks.overview") },
          { href: routes.adAccounts, label: t("quickLinks.adAccounts") },
          { href: routes.payments, label: t("quickLinks.payments") },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <FichasPanel rows={creativosClientes} />
        <ProyectosPanel rows={creativosProyectos} />
      </div>
    </div>
  );
}

async function FichasPanel({ rows }: { rows: HecomCreativoCliente[] }) {
  const t = await getTranslations("creatives");
  return (
    <CrmPanel
      title={t("ficha.title")}
      subtitle={t("ficha.contactsSubtitle", { count: rows.length })}
    >
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5">
          {t("ficha.empty")}
        </p>
      ) : (
        <ul className="max-h-[24rem] overflow-y-auto">
          {rows.map((item) => (
            <li
              key={item.id}
              className="border-b border-[var(--auth-divider)] px-4 py-3.5 last:border-0 hover:bg-[var(--auth-bg)] sm:px-5"
            >
              <p className="truncate text-[13px] font-semibold text-[var(--auth-text)]">
                {item.name}
              </p>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--auth-text-muted)]">
                {item.company ? <span>{item.company}</span> : null}
                {item.email ? <span>{item.email}</span> : null}
              </div>
              {item.email ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Link
                    href={`mailto:${item.email}?subject=${encodeURIComponent(t("ficha.emailSubject", { name: item.name }))}`}
                    className="text-[12px] font-medium text-[var(--auth-text)] hover:underline"
                  >
                    {t("ficha.writeEmail")}
                  </Link>
                  <CopyTextButton
                    value={item.email}
                    label={t("ficha.copyEmail")}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </CrmPanel>
  );
}

async function ProyectosPanel({ rows }: { rows: HecomCreativoProyecto[] }) {
  const t = await getTranslations("creatives");
  return (
    <CrmPanel title={t("proyectos.title")} subtitle={t("proyectos.subtitle")}>
      {rows.length === 0 ? (
        <div className="px-4 py-8 sm:px-5">
          <p className="text-[13px] font-medium text-[var(--auth-text-muted)]">
            {t("proyectos.empty")}
          </p>
          <Link
            href="#creative-upload"
            className="mt-2 inline-flex text-[12px] font-medium text-[var(--auth-text)] hover:underline"
          >
            {t("proyectos.goUpload")}
          </Link>
        </div>
      ) : (
        <ul className="max-h-[24rem] overflow-y-auto">
          {rows.map((row) => {
            const platform = platformLabel(row.platform);
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-4 py-3.5 last:border-0 hover:bg-[var(--auth-bg)] sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--auth-text)]">
                    {row.name}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--auth-text-muted)]">
                    {[row.type, platform, row.format].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-[var(--auth-text-muted)]">
                  {row.published ? t("proyectos.published") : t("proyectos.draft")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </CrmPanel>
  );
}
