import { DashboardLayoutChrome } from "@/components/layout/DashboardLayoutChrome.client";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { AuthDotGridBackground } from "@/features/auth/components/AuthDotGridBackground.client";
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
    avatarUrl: string | null;
  } | null = null;

  if (selected) {
    try {
      const dash = await getHecomClienteDashboard(selected.id);
      selectedCliente = {
        id: selected.id,
        name: dash?.cliente.name ?? selected.name,
        saldoEstimado: dash?.summary.saldoEstimado ?? null,
        avatarUrl: dash?.cliente.avatarUrl ?? null,
      };
    } catch {
      selectedCliente = {
        id: selected.id,
        name: selected.name,
        saldoEstimado: null,
        avatarUrl: null,
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
    <div className="dashboard-canvas relative flex min-h-screen overflow-x-hidden">
      <AuthDotGridBackground tone="light" />

      {/*
        Sidebar fixed con z-30 directo en el canvas.
        Antes el main (hermano z-10 posterior) tapaba el menú y no se podía clickear.
      */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <DashboardSidebar
          className="h-full w-full"
          selectedCliente={selectedCliente}
        />
      </aside>

      <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardLayoutChrome user={user} selectedCliente={selectedCliente}>
          {children}
        </DashboardLayoutChrome>
      </div>
    </div>
  );
}
