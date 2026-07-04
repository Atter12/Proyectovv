import { DashboardShell } from "@/components/layout/DashboardShell.client";
import { siteConfig } from "@/config/site";
import { requireSession } from "@/lib/auth/guards.server";
import { getOrganizationWallet } from "@/lib/auth/wallet.server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();
  const wallet = await getOrganizationWallet(session);

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
    <DashboardShell user={user} wallet={walletForShell}>
      {children}
    </DashboardShell>
  );
}
