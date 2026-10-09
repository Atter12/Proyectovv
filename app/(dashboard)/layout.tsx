import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { DashboardLayoutChrome } from "@/components/layout/DashboardLayoutChrome.client";
import { SidebarClienteWalletBoundary } from "@/components/layout/SidebarClienteWallet";
import { registrationNextPath } from "@/features/contracts/lib/registration-contract.server";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardSpanishLock } from "@/components/layout/DashboardSpanishLock.client";
import { requireSession } from "@/lib/auth/guards.server";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { isOtpTestClienteId } from "@/lib/hecom/clientes.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { warmHolisticBcAdvertisers } from "@/lib/integrations/tiktok/bc-advertisers.server";
import { canSwitchTesterDashboardMode } from "@/lib/auth/tester-dashboard-mode";
import { getTesterDashboardMode } from "@/lib/auth/tester-dashboard-mode.server";
import type { DashboardPersona } from "@/types/dashboard-persona";
import { getSignedPartnerForCliente } from "@/lib/partners/partners.server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const started = Date.now();
  const session = await requireSession();

  // No bloquea: el listado de BM se usa después en Cuentas ads y Pagos.
  warmHolisticBcAdvertisers({
    organizationId: session.organizationId ?? undefined,
  });

  const [funding, testerMode] = await Promise.all([
    resolvePaymentsFundingCapabilities({
      email: session.email,
      role: session.role,
    }),
    getTesterDashboardMode(session.email),
  ]);
  const canSwitchMode = canSwitchTesterDashboardMode(session.email);

  const persona: DashboardPersona = funding.isSuperAdmin
    ? "super_admin"
    : funding.isStaff
      ? "gerente"
      : "cliente";

  if (persona === "cliente") {
    const next = await registrationNextPath(session.email);
    if (next === "/contrato") redirect(routes.serviceContract);
    if (next === "/pago") redirect(routes.membershipCheckout);
  }

  let [selected, actingAsCliente] = await Promise.all([
    getSelectedHecomCliente(session.id),
    getActingAsCliente(session.id),
  ]);

  if (
    selected &&
    funding.isStaff &&
    isOtpTestClienteId(selected.id) &&
    !funding.isSuperAdmin
  ) {
    selected = null;
  }

  if (actingAsCliente && (!selected || (!funding.isStaff && !funding.isSuperAdmin))) {
    actingAsCliente = false;
  }

  const chromePersona: DashboardPersona =
    actingAsCliente && selected ? "cliente" : persona;

  // Nombre de la cookie para el topbar. Avatar y saldo van en la tarjeta, sin bloquear la página.
  const selectedCliente = selected
    ? {
        id: selected.id,
        name: selected.name,
        avatarUrl: null as string | null,
      }
    : null;
  const sessionOrganizationId = session.organizationId || null;
  const viewingAsCliente = actingAsCliente && Boolean(selected);

  // «Alianzas» solo si el chrome es de cliente y firmó el contrato (lo marca Hecom).
  const showAlliances = Boolean(
    chromePersona === "cliente" && selected
      ? await getSignedPartnerForCliente(selected.id).catch(() => null)
      : false,
  );

  const mobileWalletCard = selected ? (
    <SidebarClienteWalletBoundary
      clienteId={selected.id}
      fallbackName={selected.name}
      sessionOrganizationId={sessionOrganizationId}
      persona={chromePersona}
      actingAsCliente={viewingAsCliente}
    />
  ) : null;

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
      chromePersona,
      actingAsCliente,
      hasCliente: Boolean(selectedCliente),
    });
  }

  return (
    <DashboardSpanishLock enabled={chromePersona !== "cliente"}>
      <div className="dashboard-canvas relative flex min-h-screen max-w-full overflow-x-clip">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] lg:block">
          <DashboardSidebar
            className="h-full w-full"
            selectedCliente={selectedCliente}
            persona={chromePersona}
            actingAsCliente={viewingAsCliente}
            canSwitchMode={canSwitchMode}
            testerMode={testerMode ?? "cliente"}
            showAlliances={showAlliances}
            sessionOrganizationId={sessionOrganizationId}
          />
        </aside>

        <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
          <DashboardLayoutChrome
            user={user}
            selectedCliente={selectedCliente}
            persona={chromePersona}
            actingAsCliente={viewingAsCliente}
            canSwitchMode={canSwitchMode}
            testerMode={testerMode ?? "cliente"}
            showAlliances={showAlliances}
            walletCard={mobileWalletCard}
          >
            {children}
          </DashboardLayoutChrome>
        </div>
      </div>
    </DashboardSpanishLock>
  );
}
