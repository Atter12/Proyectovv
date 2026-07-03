import { Card } from "@/components/ui/Card";
import { HeroBanner } from "@/features/dashboard/components/HeroBanner";
import { WalletCard } from "@/features/dashboard/components/WalletCard";
import { MetricCards } from "@/features/dashboard/components/MetricCards";
import { OnboardingStepsCard } from "@/features/dashboard/components/OnboardingStepsCard";
import { AdAccountsTable } from "@/features/ad-accounts/components/AdAccountsTable";
import { getDashboardOverview } from "@/services/dashboard.mock.service";

export default async function OverviewPage() {
  const data = await getDashboardOverview();

  return (
    <div className="space-y-6">
      <HeroBanner />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OnboardingStepsCard steps={data.onboardingSteps} />
        </div>
        <WalletCard wallet={data.wallet} />
      </div>

      <MetricCards metrics={data.metrics} />

      <Card padding="none">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Cuentas publicitarias
          </h2>
        </div>
        <div className="p-2">
          <AdAccountsTable accounts={data.adAccounts} />
        </div>
      </Card>
    </div>
  );
}
