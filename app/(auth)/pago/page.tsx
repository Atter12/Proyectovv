import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { AuthSplitShell } from "@/features/auth/components/AuthSplitShell";
import { MembershipCheckout } from "@/features/contracts/components/MembershipCheckout.client";
import { loadMembershipCaptureStep, registrationNextPath } from "@/features/contracts/lib/registration-contract.server";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";
import { createClient } from "@/lib/supabase/server";

export default async function MembershipCheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect(routes.login);
  if (!user.email_confirmed_at) {
    redirect(`${routes.verifyOtp}?email=${encodeURIComponent(user.email)}`);
  }
  if (isHecomOtpStaffEmail(user.email)) redirect(routes.clientes);

  const next = await registrationNextPath(user.email);
  if (next === "/contrato") redirect(routes.serviceContract);
  if (next !== "/pago") redirect(routes.overview);
  const capture = await loadMembershipCaptureStep(user.email);

  return (
    <AuthSplitShell
      topRight={{ label: "Volver al inicio", href: routes.login }}
      caption={{
        title: "El panel espera la captura.",
        sub: "Volver de NAS no abre el acceso. Hace falta la captura del pago.",
      }}
    >
      <MembershipCheckout step={capture.step} reason={capture.reason} />
    </AuthSplitShell>
  );
}
