import { Suspense } from "react";
import { OverviewHero } from "@/features/dashboard/components/OverviewHero";
import {
  OverviewAccountsSection,
  OverviewDashboardSection,
} from "@/features/dashboard/components/OverviewDashboardSection";
import { PaymentsSectionSkeleton } from "@/features/payments/components/PaymentsSectionSkeleton";
import { requireSession } from "@/lib/auth/guards.server";

export default async function OverviewPage() {
  const session = await requireSession();

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6 lg:space-y-8">
      <OverviewHero />

      <Suspense
        fallback={
          <div className="space-y-5 lg:space-y-6">
            <PaymentsSectionSkeleton rows={2} />
            <PaymentsSectionSkeleton rows={1} />
          </div>
        }
      >
        <OverviewDashboardSection session={session} />
      </Suspense>

      <Suspense fallback={<PaymentsSectionSkeleton rows={1} />}>
        <OverviewAccountsSection session={session} />
      </Suspense>
    </div>
  );
}
