import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { getSession } from "@/lib/auth/session.server";
import { LandingPage } from "@/features/landing/LandingPage";
import { siteConfig } from "@/config/site";
import type { Metadata } from "next";
import "@/features/landing/automation-landing.css";

export const metadata: Metadata = {
  title: `${siteConfig.name} — Crece con control real en ads`,
  description:
    "Holistic Marketing: cartera, cuentas TikTok, gasto diario, pagos Hecom y operación para agencias y equipos de performance en Latam.",
};

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(routes.overview);
  }

  return <LandingPage />;
}
