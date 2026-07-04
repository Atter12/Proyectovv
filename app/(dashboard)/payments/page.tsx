import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { PaymentsGatewayPanel } from "@/features/payments/components/PaymentsGatewayPanel";
import { PaymentsPageHeader } from "@/features/payments/components/PaymentsPageHeader";
import {
  PaymentsSectionSkeleton,
  PaymentsStatsSkeleton,
} from "@/features/payments/components/PaymentsSectionSkeleton";
import { PaymentsTabsShell } from "@/features/payments/components/PaymentsTabsShell";
import { PaymentsWalletSection } from "@/features/payments/components/PaymentsWalletSection";
import { requirePermission } from "@/lib/auth/guards.server";
import { parsePaymentTab } from "@/lib/payments/tab-params";
import { getSearchParam } from "@/lib/search-params";

interface PaymentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const session = await requirePermission("payments:read");
  const params = await searchParams;
  const tab = parsePaymentTab(getSearchParam(params, "tab"));

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6 lg:space-y-8">
      <PaymentsPageHeader />

      <div className="space-y-6 lg:space-y-8">
        <Suspense fallback={<PaymentsSectionSkeleton />}>
          <PaymentsWalletSection session={session} />
        </Suspense>

        <Suspense
          fallback={
            <div className="space-y-6 lg:space-y-8">
              <PaymentsStatsSkeleton />
              <PaymentsSectionSkeleton />
            </div>
          }
        >
          <PaymentsGatewayPanel session={session} />
        </Suspense>

        <Card padding="none" className="min-w-0 overflow-hidden">
          <PaymentsTabsShell session={session} tab={tab} />
        </Card>
      </div>
    </div>
  );
}
