import Link from "next/link";
import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { AuthFormHeading, AuthNotice } from "@/features/auth/components/AuthFormUi";
import { AuthSplitShell } from "@/features/auth/components/AuthSplitShell";
import { completeNasCheckoutReturn, registrationNextPath } from "@/features/contracts/lib/registration-contract.server";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";
import { createClient } from "@/lib/supabase/server";

export default async function MembershipCheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect(routes.login);
  if (isHecomOtpStaffEmail(user.email)) redirect(routes.clientes);

  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const confirmed = await completeNasCheckoutReturn(user.email, token);
  if (confirmed) {
    const next = await registrationNextPath(user.email);
    redirect(next === "/pago" ? routes.membershipCheckout : routes.overview);
  }

  return (
    <AuthSplitShell
      topRight={{ label: "Volver al pago", href: routes.membershipCheckout }}
      caption={{
        title: "Todavía falta confirmar el pago.",
        sub: "Vuelve al checkout y termínalo para entrar al panel.",
      }}
    >
      <div className="w-full">
        <AuthFormHeading title="No pudimos confirmar el regreso">
          El enlace no coincide con el pago que abriste. Vuelve a NAS y, al final, sube la captura del cobro.
        </AuthFormHeading>
        <AuthNotice tone="info">Volver de NAS no abre el panel. El acceso sale cuando la captura queda aceptada.</AuthNotice>
        <Link href={routes.membershipCheckout} className="auth-cta mt-6">
          Volver al pago
        </Link>
      </div>
    </AuthSplitShell>
  );
}
