import { DashboardShell } from "@/components/layout/DashboardShell.client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
