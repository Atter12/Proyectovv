import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { LoginHeroPanel } from "@/features/auth/components/LoginHeroPanel";
import { LandingDotGridBackground } from "./LandingDotGridBackground.client";
import { LandingStartPanel } from "./LandingStartPanel";

/**
 * Landing clara / pro — mismo layout que auth, canvas papel cálido.
 * Login/register siguen en auth-canvas oscuro.
 */
export function LandingPage() {
  return (
    <div className="landing-canvas relative min-h-screen overflow-hidden">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-[#1a1612] focus:shadow-md"
      >
        Saltar al contenido
      </a>

      <LandingDotGridBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex shrink-0 justify-center px-4 pt-8 sm:pt-10 lg:pt-12">
          <Link href={routes.home} aria-label={siteConfig.name}>
            <AuthBrandMark tone="light" className="max-w-[240px] sm:max-w-[280px]" />
          </Link>
        </header>

        <div
          id="contenido"
          className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col lg:grid lg:grid-cols-[1fr_400px] lg:items-center lg:gap-8 lg:px-8 xl:gap-10 xl:px-10"
        >
          <LoginHeroPanel alwaysVisible />

          <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:flex-none lg:items-stretch lg:px-0 lg:py-10">
            <LandingStartPanel />

            <p className="mt-5 text-center text-[13px] tracking-wide text-[var(--auth-text-soft)] lg:text-left">
              © {new Date().getFullYear()} {siteConfig.companyName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
