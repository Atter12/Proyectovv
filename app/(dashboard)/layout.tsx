import { DashboardLayoutChrome } from "@/components/layout/DashboardLayoutChrome.client";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { requireSession } from "@/lib/auth/guards.server";
import { getHecomClienteShell } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { isOtpTestClienteId } from "@/lib/hecom/clientes.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import type { DashboardPersona } from "@/types/dashboard-persona";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  const persona: DashboardPersona = funding.isSuperAdmin
    ? "super_admin"
    : funding.isStaff
      ? "gerente"
      : "cliente";

  // Scope por userId: no mezclar selección entre cliente y gerente en el mismo browser.
  let selected = await getSelectedHecomCliente(session.id);

  // Gerente no debe quedar pegado a un cliente demo OTP.
  if (
    selected &&
    funding.isStaff &&
    isOtpTestClienteId(selected.id) &&
    !funding.isSuperAdmin
  ) {
    selected = null;
  }

  let selectedCliente: {
    id: string;
    name: string;
    saldoEstimado: number | null;
    avatarUrl: string | null;
  } | null = null;

  if (selected) {
    try {
      const shell = await getHecomClienteShell(selected.id);
      selectedCliente = shell
        ? {
            id: shell.id,
            name: shell.name,
            saldoEstimado: shell.saldoEstimado,
            avatarUrl: shell.avatarUrl,
          }
        : {
            id: selected.id,
            name: selected.name,
            saldoEstimado: null,
            avatarUrl: null,
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] lg:block">
        <DashboardSidebar
          className="h-full w-full"
          selectedCliente={selectedCliente}
          persona={persona}
        />
      </aside>

      <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardLayoutChrome
          user={user}
          selectedCliente={selectedCliente}
          persona={persona}
        >
          {children}
        </DashboardLayoutChrome>
      </div>
    </div>
  );
}
