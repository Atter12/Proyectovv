import { DashboardLayoutChrome } from "@/components/layout/DashboardLayoutChrome.client";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { requireSession } from "@/lib/auth/guards.server";
import { getHecomClienteShell } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { isOtpTestClienteId } from "@/lib/hecom/clientes.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { getWalletLedgerBalance } from "@/lib/ledger/ledger.server";
import { warmHolisticBcAdvertisers } from "@/lib/integrations/tiktok/bc-advertisers.server";
import type { DashboardPersona } from "@/types/dashboard-persona";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const started = Date.now();
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

  let selected = await getSelectedHecomCliente(session.id);

  if (
    selected &&
    funding.isStaff &&
    isOtpTestClienteId(selected.id) &&
    !funding.isSuperAdmin
  ) {
    selected = null;
  }

  // Precalienta cache TikTok BC en background (Cuentas ads / Pagos más rápidos).
  warmHolisticBcAdvertisers({
    organizationId: session.organizationId ?? undefined,
  });

  let selectedCliente: {
    id: string;
    name: string;
    saldoEstimado?: number | null;
    walletBalanceCents?: number | null;
    walletCurrency?: string;
    avatarUrl: string | null;
  } | null = null;

  if (selected) {
    try {
      const shell = await getHecomClienteShell(selected.id, {
        includeSaldo: persona !== "cliente",
      });

      if (persona === "cliente" && session.organizationId) {
        const wallet = await getWalletLedgerBalance(session.organizationId);
        selectedCliente = {
          id: shell?.id ?? selected.id,
          name: shell?.name ?? selected.name,
          walletBalanceCents: wallet?.availableBalanceCents ?? 0,
          walletCurrency: wallet?.currency ?? "USD",
          avatarUrl: shell?.avatarUrl ?? null,
        };
      } else {
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
      }
    } catch {
      selectedCliente = {
        id: selected.id,
        name: selected.name,
        ...(persona === "cliente"
          ? { walletBalanceCents: 0, walletCurrency: "USD" }
          : { saldoEstimado: null }),
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

  if (process.env.NODE_ENV !== "production" || Date.now() - started > 400) {
    console.info("[dashboard-layout]", {
      ms: Date.now() - started,
      persona,
      hasCliente: Boolean(selectedCliente),
    });
  }

  return (
    <div className="dashboard-canvas relative flex min-h-screen overflow-x-hidden">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] lg:block">
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
