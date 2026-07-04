import { Suspense } from "react";
import { AffiliateHero } from "@/features/affiliates/components/AffiliateHero";
import { AffiliateOverviewStats } from "@/features/affiliates/components/AffiliateOverviewStats";
import { AffiliateTabContent } from "@/features/affiliates/components/AffiliateTabContent";
import { AffiliateTabNav } from "@/features/affiliates/components/AffiliateTabNav.client";
import { AffiliatesPageHeader } from "@/features/affiliates/components/AffiliatesPageHeader";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSearchParam } from "@/lib/search-params";
import { getAffiliateProgram } from "@/services/affiliates.service";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import type { AffiliateTabKey } from "@/types/affiliate";

interface AffiliatesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AffiliatesPage({
  searchParams,
}: AffiliatesPageProps) {
  const session = await requirePermission("affiliates:read");
  const params = await searchParams;
  const tabParam = getSearchParam(params, "tab", "earn");
  const tab: AffiliateTabKey =
    tabParam === "payments" ? "payments" : "earn";
  const data = await getAffiliateProgram(session);

  return (
    <div className={dashboardClasses.page}>
      <AffiliatesPageHeader data={data} />
      <AffiliateHero data={data} />
      <AffiliateOverviewStats stats={data.stats} />
      <div>
        <Suspense fallback={null}>
          <AffiliateTabNav activeTab={tab} />
        </Suspense>
        <div className={`${dashboardClasses.tabPanel} p-4 sm:p-6`}>
          <AffiliateTabContent data={data} tab={tab} />
        </div>
      </div>
    </div>
  );
}
