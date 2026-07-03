import { AffiliateHero } from "@/features/affiliates/components/AffiliateHero";
import { AffiliateOverviewStats } from "@/features/affiliates/components/AffiliateOverviewStats";
import { AffiliateTabContent } from "@/features/affiliates/components/AffiliateTabContent";
import { AffiliateTabNav } from "@/features/affiliates/components/AffiliateTabNav.client";
import { AffiliatesPageHeader } from "@/features/affiliates/components/AffiliatesPageHeader";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSearchParam } from "@/lib/search-params";
import { getAffiliateProgram } from "@/services/affiliates.mock.service";
import type { AffiliateTabKey } from "@/types/affiliate";
import { Suspense } from "react";

interface AffiliatesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AffiliatesPage({
  searchParams,
}: AffiliatesPageProps) {
  await requirePermission("affiliates:read");
  const params = await searchParams;
  const tabParam = getSearchParam(params, "tab", "earn");
  const tab: AffiliateTabKey =
    tabParam === "payments" ? "payments" : "earn";
  const data = await getAffiliateProgram();

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6 lg:space-y-8">
      <AffiliatesPageHeader data={data} />
      <AffiliateHero data={data} />
      <AffiliateOverviewStats stats={data.stats} />
      <div>
        <Suspense fallback={null}>
          <AffiliateTabNav activeTab={tab} />
        </Suspense>
        <div className="rounded-b-2xl rounded-tr-2xl border border-t-0 border-[#e5e7eb] bg-white p-4 sm:p-6">
          <AffiliateTabContent data={data} tab={tab} />
        </div>
      </div>
    </div>
  );
}
