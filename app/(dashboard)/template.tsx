import { PageTransition } from "@/components/layout/PageTransition.client";

export default function DashboardTemplate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <PageTransition>{children}</PageTransition>;
}
