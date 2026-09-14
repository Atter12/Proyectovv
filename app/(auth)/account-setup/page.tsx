import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { AccountSetupPendingCard } from "@/features/auth/components/AccountSetupPendingCard.client";
import { AuthSplitShell } from "@/features/auth/components/AuthSplitShell";
import { ensureAccountProvisionedForUser } from "@/lib/auth/account-provisioning.server";
import { createClient } from "@/lib/supabase/server";

export default async function AccountSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(routes.login);
  }

  if (!user.email_confirmed_at) {
    const verifyUrl = `${routes.verifyOtp}?email=${encodeURIComponent(user.email ?? "")}`;
    redirect(verifyUrl);
  }

  const result = await ensureAccountProvisionedForUser(user);
  if (result.ready) {
    redirect(routes.overview);
  }

  return (
    <AuthSplitShell
      topRight={{ label: "Volver al inicio", href: routes.login }}
      caption={{
        title: "Tu próxima campaña empieza aquí.",
        sub: "Tus cuentas publicitarias y tu cartera, en un solo lugar.",
      }}
    >
      <AccountSetupPendingCard error={result.error} />
    </AuthSplitShell>
  );
}
