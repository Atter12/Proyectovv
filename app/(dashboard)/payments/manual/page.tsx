import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ManualVoucherReviewHost } from "@/features/payments/components/ManualVoucherReviewHost";
import { requirePermission } from "@/lib/auth/guards.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

export default async function ManualPaymentsReviewPage() {
  const session = await requirePermission("payments:read");
  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  if (!capabilities.isStaff && !capabilities.isSuperAdmin) {
    redirect(routes.payments);
  }

  return (
    <div className={dashboardClasses.page}>
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--auth-muted)]">
          Gerente · Finanzas
        </p>
        <h1 className="text-xl font-bold tracking-tight text-[var(--auth-text)] sm:text-2xl">
          Pagos manuales
        </h1>
        <p className="max-w-2xl text-sm text-[var(--auth-muted)]">
          Acá llegan las boletas BCP. Aceptá para acreditar cartera o rechazá
          con motivo. Stripe y asignación TikTok siguen en{" "}
          <a
            href={routes.payments}
            className="font-semibold text-[var(--brand-primary)] underline-offset-2 hover:underline"
          >
            Pagos
          </a>
          .
        </p>
      </header>

      <ManualVoucherReviewHost staffMode />
    </div>
  );
}
