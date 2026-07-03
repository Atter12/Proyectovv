import { DashboardShell } from "@/components/layout/DashboardShell.client";
import { requireSession } from "@/lib/auth/guards.server";
import { walletMock } from "@/mocks/wallet.mock";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  const user = {
    id: session.id,
    name: session.name,
    email: session.email,
    avatarInitials: session.avatarInitials,
  };

  return (
    <DashboardShell user={user} wallet={walletMock}>
      {children}
    </DashboardShell>
  );
}
