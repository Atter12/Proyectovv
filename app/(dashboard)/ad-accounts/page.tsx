import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { Card } from "@/components/ui/Card";
import { AdAccountsPageHeader } from "@/features/ad-accounts/components/AdAccountsPageHeader";
import { AdAccountsInfoAlert } from "@/features/ad-accounts/components/AdAccountsInfoAlert";
import { AdAccountsSummaryCards } from "@/features/ad-accounts/components/AdAccountsSummaryCards";
import { AdAccountsTable } from "@/features/ad-accounts/components/AdAccountsTable";
import { AdAccountsToolbar } from "@/features/ad-accounts/components/AdAccountsToolbar.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { filterAdAccounts } from "@/lib/filter/ad-accounts";
import { getSearchParam } from "@/lib/search-params";
import { getAdAccountsOverview } from "@/services/ad-accounts.service";
import { Suspense } from "react";

interface AdAccountsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdAccountsPage({ searchParams }: AdAccountsPageProps) {
  const session = await requirePermission("adAccounts:read");
  const params = await searchParams;
  const search = getSearchParam(params, "q");
  const status = getSearchParam(params, "status", "all");
  const data = await getAdAccountsOverview(session);
  const filteredAccounts = filterAdAccounts(data.accounts, { search, status });

  return (
    <div className={dashboardClasses.page}>
      <AdAccountsPageHeader summary={data.summary} />
      <AdAccountsInfoAlert />
      <AdAccountsSummaryCards summary={data.summary} />
      <Card padding="none" className="overflow-hidden">
        <Suspense fallback={null}>
          <AdAccountsToolbar initialSearch={search} initialStatus={status} />
        </Suspense>
        <AdAccountsTable accounts={filteredAccounts} />
      </Card>
    </div>
  );
}
