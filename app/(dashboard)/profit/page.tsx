import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { ProfitPageClient } from "@/features/profit/components/ProfitPageClient.client";
import { requirePermission } from "@/lib/auth/guards.server";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import {
  resolvePaymentsFundingCapabilities,
} from "@/lib/payments/funding-roles.server";

export default async function ProfitPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requirePermission("adAccounts:read");
  const actingAsCliente = await getActingAsCliente(session.id);
  const rawFunding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  // Rol real del gerente: el score debe verse aunque esté “viendo como” cliente.
  const isStaffViewer = rawFunding.isStaff || rawFunding.isSuperAdmin;
  const canPickCliente = isStaffViewer || actingAsCliente;
  const mode = canPickCliente ? "staff" : "cliente";
  const selected = await getSelectedHecomCliente(session.id);
  const params = (await searchParams) ?? {};
  const initialFrom = params.from?.trim() || undefined;
  const initialTo = params.to?.trim() || undefined;

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="Profit" mode={mode} />
      </div>
    );
  }

  return (
    <div className={dashboardClasses.page}>
      <ProfitPageClient
        clienteName={selected.name}
        isStaff={isStaffViewer}
        initialFrom={initialFrom}
        initialTo={initialTo}
      />
    </div>
  );
}
