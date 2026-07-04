import { Suspense } from "react";
import { PaymentsTabNav } from "./PaymentsTabNav.client";
import { PaymentsTabPanel } from "./PaymentsTabPanel";
import { PaymentsTabContentSkeleton } from "./PaymentsSectionSkeleton";
import type { SessionUser } from "@/types/auth";
import type { PaymentTabKey } from "@/types/payment";

interface PaymentsTabsShellProps {
  session: SessionUser;
  tab: PaymentTabKey;
}

export function PaymentsTabsShell({ session, tab }: PaymentsTabsShellProps) {
  return (
    <>
      <Suspense fallback={<div className="h-12 animate-pulse border-b border-[#e5e7eb] bg-slate-50" />}>
        <PaymentsTabNav activeTab={tab} />
      </Suspense>
      <Suspense fallback={<PaymentsTabContentSkeleton />} key={tab}>
        <PaymentsTabPanel session={session} tab={tab} />
      </Suspense>
    </>
  );
}
