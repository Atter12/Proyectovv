import { Suspense } from "react";
import { requireSession } from "@/lib/auth/guards.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { SupportPageClient } from "@/features/support/components/SupportPageClient.client";
import { GerenteSupportInbox } from "@/features/support/components/GerenteSupportInbox.client";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const session = await requireSession();
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const isGerenteInbox = funding.isStaff || funding.isSuperAdmin;

  return (
    <Suspense
      fallback={
        <div className="dashboard-surface-card rounded-[1rem] p-8 text-center text-[14px] font-medium text-[var(--auth-text-muted)]">
          Cargando soporte…
        </div>
      }
    >
      {isGerenteInbox ? <GerenteSupportInbox /> : <SupportPageClient />}
    </Suspense>
  );
}
