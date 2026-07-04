import { DashboardLayoutChrome } from "@/components/layout/DashboardLayoutChrome.client";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { siteConfig } from "@/config/site";
import { requireSession } from "@/lib/auth/guards.server";
import { getOrganizationWallet } from "@/lib/auth/wallet.server";
import { getOnboardingStatus } from "@/services/onboarding.service";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();
  const [wallet, onboarding] = await Promise.all([
    getOrganizationWallet(session),
    getOnboardingStatus(session),
  ]);

  const user = {
    id: session.id,
    name: session.name,
    email: session.email,
    avatarInitials: session.avatarInitials,
  };

  const walletForShell = wallet ?? {
    id: "pending",
    name: siteConfig.walletName,
    balance: 0,
    currency: "USD",
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#f5f7fb]">
      <div className="hidden lg:block">
        <DashboardSidebar
          wallet={walletForShell}
          className="fixed inset-y-0 left-0 z-30 h-full w-64"
        />
      </div>

      <DashboardLayoutChrome
        user={user}
        wallet={walletForShell}
        onboarding={onboarding}
      >
        {children}
      </DashboardLayoutChrome>
    </div>
  );
}
