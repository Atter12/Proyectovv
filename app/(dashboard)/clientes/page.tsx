import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guards.server";
import { routes } from "@/config/routes";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { ClientesPageClient } from "@/features/clientes/components/ClientesPageClient.client";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const session = await requireSession();
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  // Cliente final no tiene listado CRM de “todos los clientes”.
  if (!funding.isStaff && !funding.isSuperAdmin) {
    redirect(routes.overview);
  }

  return (
    <Suspense
      fallback={
        <div className="dashboard-surface-card rounded-[1rem] p-8 text-center text-[14px] font-medium text-[var(--auth-text-muted)]">
          Cargando clientes…
        </div>
      }
    >
      <ClientesPageClient mode="staff" />
    </Suspense>
  );
}
