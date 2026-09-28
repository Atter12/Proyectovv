import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { AuthSplitShell } from "@/features/auth/components/AuthSplitShell";
import { ClientContractForm } from "@/features/contracts/components/ClientContractForm.client";
import {
  loadRegistrationContractPrefill,
  registrationNextPath,
  serviceContractAlreadySent,
} from "@/features/contracts/lib/registration-contract.server";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";
import { createClient } from "@/lib/supabase/server";

export default async function ClientContractPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect(routes.login);
  if (!user.email_confirmed_at) {
    redirect(`${routes.verifyOtp}?email=${encodeURIComponent(user.email)}`);
  }
  if (isHecomOtpStaffEmail(user.email)) redirect(routes.clientes);
  if (await serviceContractAlreadySent(user.email)) {
    const next = await registrationNextPath(user.email);
    redirect(next === "/pago" ? routes.membershipCheckout : routes.overview);
  }

  const prefill = await loadRegistrationContractPrefill(user.email);

  return (
    <AuthSplitShell
      topRight={{ label: "Volver al inicio", href: routes.login }}
      caption={{
        title: "Firma y empieza sin pagar entrada.",
        sub: "El 10% de comisión queda fijo en tu contrato.",
      }}
    >
      <ClientContractForm
        legalName={prefill.legalName}
        docNumber={prefill.docNumber}
        phone={prefill.phone}
        email={prefill.email}
      />
    </AuthSplitShell>
  );
}
