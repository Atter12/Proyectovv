import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { getSession } from "@/lib/auth/session.server";
import { LandingPage } from "@/features/landing/LandingPage";
import { getLandingCopy } from "@/features/landing/i18n/landing-copy";
import { getLandingLocale } from "@/features/landing/i18n/landing-locale.server";
import type { Metadata } from "next";
import "@/features/landing/automation-landing.css";

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = getLandingCopy(await getLandingLocale());
  return { title: meta.title, description: meta.description };
}

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(routes.overview);
  }

  return <LandingPage locale={await getLandingLocale()} />;
}
