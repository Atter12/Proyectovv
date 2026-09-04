import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { PixelsPageClient } from "@/features/pixels/components/PixelsPageClient.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export default async function PixelsPage() {
  const session = await requirePermission("adAccounts:read");
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const mode =
    funding.isStaff || funding.isSuperAdmin ? "staff" : "cliente";
  const selected = await getSelectedHecomCliente(session.id);

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="Píxeles TikTok" mode={mode} />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <PixelsPageClient clienteName={selected.name} />
    </div>
  );
}
