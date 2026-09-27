import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { LinksDeudaPanel } from "@/features/clientes/components/LinksDeudaPanel.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { listDebtLinkClients } from "@/lib/hecom/lo-pagado-staff-links.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

export default async function LinksDeudaPage() {
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

  let ready = false;
  let clients: Awaited<ReturnType<typeof listDebtLinkClients>>["clients"] = [];
  let loadError: string | null = null;
  try {
    const listed = await listDebtLinkClients();
    ready = listed.ready;
    clients = listed.clients;
  } catch {
    loadError = "No se pudo cargar la lista de clientes.";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">
          Gerente
        </p>
        <h1 className="mt-0.5 text-[1.15rem] font-semibold tracking-[-0.02em] text-[#1a1714]">
          Links deuda
        </h1>
        <p className="mt-1 max-w-xl text-[13px] leading-5 text-[#6b645c]">
          Elige un cliente y copia su link. Ve lo que debe, sus pagos y gastos,
          y puede abonar o subir comprobante.
        </p>
      </header>

      {loadError ? (
        <p className="rounded-2xl bg-white px-4 py-6 text-[13px] text-[#9a3412] ring-1 ring-[#e8dfd4]">
          {loadError}
        </p>
      ) : !ready ? (
        <p className="rounded-2xl bg-white px-4 py-6 text-[13px] text-[#5c564e] ring-1 ring-[#e8dfd4]">
          En este ambiente todavía no se pueden armar los links.
        </p>
      ) : (
        <LinksDeudaPanel clients={clients} />
      )}
    </div>
  );
}
