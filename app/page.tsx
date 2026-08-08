import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { getSession } from "@/lib/auth/session.server";
import { LandingPage } from "@/features/landing/LandingPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Automation SaaS || Nexsas",
  description:
    "Automate your workflows and eliminate manual tasks with Nexsas — connect tools, design smart workflows, and run on autopilot.",
};

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(routes.overview);
  }

  return <LandingPage />;
}
