import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { getSession } from "@/lib/auth/session.server";
import { LandingPage } from "@/features/landing/LandingPage";
import { siteConfig } from "@/config/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `${siteConfig.name} — Crece con control real en ads`,
  description:
    "Landing Holistic Marketing: cartera, cuentas TikTok, pagos y operación para agencias y equipos de performance en Latam.",
};

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(routes.overview);
  }

  return <LandingPage />;
}
