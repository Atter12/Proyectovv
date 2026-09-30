import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { PrepagoMonitor } from "@/features/ops/components/PrepagoMonitor.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

export default async function MonitoreoPage() {
  const session = await requirePermission("payments:read");
  const capabilities = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  if (!capabilities.isStaff && !capabilities.isSuperAdmin) {
    redirect(routes.overview);
  }

  if (await getActingAsCliente(session.id)) {
    redirect(routes.overview);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">
          Gerente
        </p>
        <h1 className="mt-0.5 text-[1.15rem] font-semibold tracking-[-0.02em] text-[#1a1714]">
          Monitoreo prepago
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
          Quién puede gastar plata que no pagó, quién ya debe y qué movimientos
          raros hubo. Cada cliente solo debe gastar lo que recargó.
        </p>
      </header>

      <PrepagoMonitor />
    </div>
  );
}
