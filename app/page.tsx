import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { getSession } from "@/lib/auth/session.server";
import { LandingPage } from "@/features/landing/LandingPage";
import { siteConfig } from "@/config/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `${siteConfig.name} — Opera campañas, pagos y saldos`,
  description:
    "Panel del anunciante: recargá la cartera Holistic, asigná a cuentas TikTok y operá campañas en un solo lugar.",
};

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(routes.overview);
  }

  return <LandingPage />;
}
