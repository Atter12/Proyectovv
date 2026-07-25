import { DashboardLayoutChrome } from "@/components/layout/DashboardLayoutChrome.client";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { requireSession } from "@/lib/auth/guards.server";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();
  const selected = await getSelectedHecomCliente();

  let selectedCliente: {
    id: string;
    name: string;
    saldoEstimado: number | null;
  } | null = null;

  if (selected) {
    try {
      const dash = await getHecomClienteDashboard(selected.id);
      selectedCliente = {
        id: selected.id,
        name: dash?.cliente.name ?? selected.name,
        saldoEstimado: dash?.summary.saldoEstimado ?? null,
      };
    } catch {
      selectedCliente = {
        id: selected.id,
        name: selected.name,
        saldoEstimado: null,
      };
    }
  }

  const user = {
    id: session.id,
    name: session.name,
    email: session.email,
    avatarInitials: session.avatarInitials,
  };

  return (
    <div className="dashboard-canvas flex min-h-screen overflow-x-hidden">
      <div className="hidden lg:block">
        <DashboardSidebar
          className="fixed inset-y-0 left-0 z-30 h-full w-64"
          selectedCliente={selectedCliente}
        />
      </div>

      <DashboardLayoutChrome user={user} selectedCliente={selectedCliente}>
        {children}
      </DashboardLayoutChrome>
    </div>
  );
}
