import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { AccountSetupPendingCard } from "@/features/auth/components/AccountSetupPendingCard.client";
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
    <div className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-slate-50 px-4 py-8 sm:px-6">
      <AccountSetupPendingCard error={result.error} />
      <p className="mt-8 text-xs text-slate-400">
        © {new Date().getFullYear()} {siteConfig.companyName}
      </p>
    </div>
  );
}
