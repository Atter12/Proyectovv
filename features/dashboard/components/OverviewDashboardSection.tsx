import { Card } from "@/components/ui/Card";
import { AdAccountsOverviewTable } from "@/features/dashboard/components/AdAccountsOverviewTable";
import { MetricsGrid } from "@/features/dashboard/components/MetricsGrid";
import { OnboardingStepsCard } from "@/features/dashboard/components/OnboardingStepsCard";
import { WalletOverviewCard } from "@/features/dashboard/components/WalletOverviewCard";
import { getDashboardOverview } from "@/services/dashboard.service";
import type { SessionUser } from "@/types/auth";

interface OverviewDashboardSectionProps {
  session: SessionUser;
}

export async function OverviewDashboardSection({
  session,
}: OverviewDashboardSectionProps) {
  const data = await getDashboardOverview(session);

  return (
    <>
      <div className="grid min-w-0 gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="min-w-0 lg:col-span-2">
          <OnboardingStepsCard steps={data.onboardingSteps} />
        </div>
        <WalletOverviewCard wallet={data.wallet} />
      </div>

      <MetricsGrid metrics={data.metrics} />
    </>
  );
}

interface OverviewAccountsSectionProps {
  session: SessionUser;
}

export async function OverviewAccountsSection({
  session,
}: OverviewAccountsSectionProps) {
  const data = await getDashboardOverview(session);

  return (
    <Card padding="none" className="overflow-hidden">
      <AdAccountsOverviewTable accounts={data.adAccounts} />
    </Card>
  );
}
