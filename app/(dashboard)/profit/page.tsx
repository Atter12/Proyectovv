import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { ProfitPageClient } from "@/features/profit/components/ProfitPageClient.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export default async function ProfitPage() {
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
        <PickClienteEmpty section="Profit / ROAS" mode={mode} />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <ProfitPageClient
        clienteName={selected.name}
        isStaff={funding.isStaff || funding.isSuperAdmin}
      />
    </div>
  );
}
