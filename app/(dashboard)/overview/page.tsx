import { Card } from "@/components/ui/Card";
import { OverviewHero } from "@/features/dashboard/components/OverviewHero";
import { WalletOverviewCard } from "@/features/dashboard/components/WalletOverviewCard";
import { MetricsGrid } from "@/features/dashboard/components/MetricsGrid";
import { OnboardingStepsCard } from "@/features/dashboard/components/OnboardingStepsCard";
import { AdAccountsOverviewTable } from "@/features/dashboard/components/AdAccountsOverviewTable";
import { requireSession } from "@/lib/auth/guards.server";
import { getDashboardOverview } from "@/services/dashboard.service";

export default async function OverviewPage() {
  const session = await requireSession();
  const data = await getDashboardOverview(session);

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6 lg:space-y-8">
      <OverviewHero />

      <div className="grid min-w-0 gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="min-w-0 lg:col-span-2">
          <OnboardingStepsCard steps={data.onboardingSteps} />
        </div>
        <WalletOverviewCard wallet={data.wallet} />
      </div>

      <MetricsGrid metrics={data.metrics} />

      <Card padding="none" className="overflow-hidden">
        <AdAccountsOverviewTable accounts={data.adAccounts} />
      </Card>
    </div>
  );
}
