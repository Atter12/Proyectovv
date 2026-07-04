import { DashboardLayoutChrome } from "@/components/layout/DashboardLayoutChrome.client";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { requireSession } from "@/lib/auth/guards.server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();

  const user = {
    id: session.id,
    name: session.name,
    email: session.email,
    avatarInitials: session.avatarInitials,
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#f5f7fb]">
      <div className="hidden lg:block">
        <DashboardSidebar className="fixed inset-y-0 left-0 z-30 h-full w-64" />
      </div>

      <DashboardLayoutChrome user={user}>{children}</DashboardLayoutChrome>
    </div>
  );
}
