import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { AlianzasPanel } from "@/features/partners/components/AlianzasPanel.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { listPartnersWithStats, type PartnerWithStats } from "@/lib/partners/partners-admin.server";

export const dynamic = "force-dynamic";

export default async function AlianzasPage() {
  const session = await requirePermission("payments:read");
  const capabilities = await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role });
  if (!capabilities.isStaff && !capabilities.isSuperAdmin) redirect(routes.overview);
  if (await getActingAsCliente(session.id)) redirect(routes.overview);

  let partners: PartnerWithStats[] = [];
  let loadError: string | null = null;
  try {
    partners = await listPartnersWithStats();
  } catch {
    loadError = "No se pudo cargar las alianzas.";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">Gerente</p>
        <h1 className="mt-0.5 text-[1.15rem] font-semibold tracking-[-0.02em] text-[#1a1714]">Alianzas</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
          Cada aliado tiene su landing en <strong>adsholistic.com/a/&lt;link&gt;</strong>. Los clientes que se registran
          por ahí quedan a su nombre y el aliado gana un % del fee que les cobramos.
        </p>
      </header>
      {loadError ? (
        <p className="rounded-xl bg-[#fff1ee] px-4 py-3 text-[13px] text-[#a32e23]">{loadError}</p>
      ) : (
        <AlianzasPanel partners={partners} />
      )}
    </div>
  );
}
