import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { Card } from "@/components/ui/Card";
import { AdAccountsPageHeader } from "@/features/ad-accounts/components/AdAccountsPageHeader";
import { AdAccountsInfoAlert } from "@/features/ad-accounts/components/AdAccountsInfoAlert";
import { AdAccountsMobileStickyCta } from "@/features/ad-accounts/components/AdAccountsMobileStickyCta.client";
import { AdAccountsSummaryCards } from "@/features/ad-accounts/components/AdAccountsSummaryCards";
import { AdAccountsTable } from "@/features/ad-accounts/components/AdAccountsTable";
import { AdAccountsToolbar } from "@/features/ad-accounts/components/AdAccountsToolbar.client";
import { TikTokConnectPanel } from "@/features/ad-accounts/components/TikTokConnectPanel.client";
import { TikTokIntegrationBanner } from "@/features/ad-accounts/components/TikTokIntegrationBanner.client";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guards.server";
import { getTikTokConnectionStatus } from "@/lib/integrations/tiktok/client.server";
import { filterAdAccounts } from "@/lib/filter/ad-accounts";
import { getSearchParam } from "@/lib/search-params";
import { getAdAccountsOverview } from "@/services/ad-accounts.service";
import type { AdAccountStatus } from "@/types/ad-account";
import { Suspense } from "react";

interface AdAccountsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ACCOUNT_STATUSES = new Set<AdAccountStatus>([
  "active",
  "pending",
  "disabled",
  "review",
  "archived",
]);

function resolveAccountStatusFilter(raw: string): string {
  if (raw === "all" || ACCOUNT_STATUSES.has(raw as AdAccountStatus)) return raw;
  return "all";
}

export default async function AdAccountsPage({ searchParams }: AdAccountsPageProps) {
  const session = await requirePermission("adAccounts:read");
  const params = await searchParams;
  const search = getSearchParam(params, "q");
  const status = resolveAccountStatusFilter(getSearchParam(params, "status", "all"));
  const includeArchived = getSearchParam(params, "archived") === "1";
  const data = await getAdAccountsOverview(session, { includeArchived });
  const filteredAccounts = filterAdAccounts(data.accounts, { search, status });
  const tiktokStatus = session.organizationId
    ? await getTikTokConnectionStatus(session.organizationId)
    : {
        configured: false,
        connected: false,
        connectionId: null,
        status: null,
        scopes: [],
        lastSyncedAt: null,
        updatedAt: null,
        importedTikTokAccounts: 0,
        lastError: null,
      };
  const canManageTikTok =
    hasPermission(session.permissions, "settings:update") ||
    hasPermission(session.permissions, "adAccounts:create");

  return (
    <div className={`${dashboardClasses.page} pb-24 md:pb-0`}>
      <AdAccountsPageHeader summary={data.summary} />
      <Suspense fallback={null}>
        <TikTokIntegrationBanner />
      </Suspense>
      <TikTokConnectPanel
        organizationName={session.organizationName || "Tu organización"}
        initialStatus={tiktokStatus}
        canManage={canManageTikTok}
      />
      <AdAccountsInfoAlert />
      <AdAccountsSummaryCards summary={data.summary} />
      <Card padding="none" className="overflow-hidden">
        <Suspense fallback={null}>
          <AdAccountsToolbar
            initialSearch={search}
            initialStatus={status}
            initialIncludeArchived={includeArchived}
          />
        </Suspense>
        <AdAccountsTable accounts={filteredAccounts} />
      </Card>
      <AdAccountsMobileStickyCta />
    </div>
  );
}
