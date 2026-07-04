import { AccountSetupPendingCard } from "@/features/auth/components/AccountSetupPendingCard.client";
import { siteConfig } from "@/config/site";

export default function AccountSetupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-slate-50 px-4 py-8 sm:px-6">
      <AccountSetupPendingCard />
      <p className="mt-8 text-xs text-slate-400">
        © {new Date().getFullYear()} {siteConfig.companyName}
      </p>
    </div>
  );
}
