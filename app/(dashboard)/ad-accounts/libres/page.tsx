import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { FreeTikTokAccountsManager } from "@/features/ad-accounts/components/FreeTikTokAccountsManager.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { isPaymentsSuperAdminEmail } from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

export default async function CuentasLibresPage() {
  const session = await requirePermission("payments:read");
  const email = String(session.email ?? "");
  if (!isHecomOtpStaffEmail(email) && !isPaymentsSuperAdminEmail(email)) {
    redirect(routes.overview);
  }
  if (await getActingAsCliente(session.id)) {
    redirect(routes.overview);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">Gerente</p>
        <h1 className="mt-0.5 text-[1.15rem] font-semibold tracking-[-0.02em] text-[#1a1714]">Cuentas libres</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
          Crea cuentas de reserva en tandas y entrégalas a un miembro del equipo o a un cliente. Libre = sin dueño en Hecom.
        </p>
      </header>

      <FreeTikTokAccountsManager />
    </div>
  );
}
