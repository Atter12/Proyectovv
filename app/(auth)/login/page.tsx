import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/LoginForm.client";
import { LoginHeroPanel } from "@/features/auth/components/LoginHeroPanel";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { clerkLoginEnabled, clerkRoutes } from "@/lib/auth/clerk";
import { serverEnv } from "@/lib/env/env.server";

function AuthCardFallback() {
  return (
    <div className="w-full animate-pulse space-y-4 py-4">
      <div className="h-3 w-28 rounded bg-[var(--auth-skeleton)]" />
      <div className="h-8 w-48 rounded bg-[var(--auth-skeleton)]" />
      <div className="h-4 w-56 rounded bg-[var(--auth-skeleton)]" />
      <div className="h-12 rounded-[0.9rem] bg-[var(--auth-skeleton)]" />
      <div className="h-12 rounded-[0.9rem] bg-[var(--auth-accent)]/25" />
    </div>
  );
}

/**
 * Login mockup Holistic — card split + atmósfera peach.
 */
export default function LoginPage() {
  if (clerkLoginEnabled()) {
    redirect(clerkRoutes.signIn);
  }

  return (
    <div className="auth-canvas mortgage-login holistic-login relative min-h-screen overflow-x-hidden">
      <p
        className="holistic-login-script pointer-events-none absolute left-3 top-[42%] z-0 hidden -translate-y-1/2 -rotate-90 select-none whitespace-nowrap text-[1.35rem] text-[#c9c0b6] xl:left-5 xl:block xl:text-[1.55rem]"
        aria-hidden
      >
        Ideas que generan resultados
      </p>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="px-4 pt-5 sm:px-6 sm:pt-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1080px] items-center justify-between gap-4">
            <Link
              href={routes.home}
              aria-label={siteConfig.name}
              className="inline-flex shrink-0 items-center"
            >
              <AuthBrandMark
                tone="light"
                compact
                className="!w-auto max-w-[128px] sm:max-w-[168px]"
              />
            </Link>

            <div className="flex items-center gap-3 sm:gap-5">
              <nav
                className="hidden items-center gap-2 text-[13px] font-medium text-[#8a8278] md:flex"
                aria-label="Marca"
              >
                <span>Estrategia</span>
                <span className="text-[#d0c8be]" aria-hidden>
                  ·
                </span>
                <span>Marca</span>
                <span className="text-[#d0c8be]" aria-hidden>
                  ·
                </span>
                <span>Crecimiento</span>
              </nav>
              <Link
                href={routes.register}
                className="shrink-0 rounded-[0.75rem] bg-[var(--auth-accent)] px-4 py-2.5 text-[0.8125rem] font-bold text-white shadow-[0_10px_22px_rgb(255_120_31_/_0.28)] transition-[filter] hover:brightness-[1.05] sm:px-5 sm:text-[0.875rem]"
              >
                Registrarme
              </Link>
            </div>
          </div>
        </header>

        <main className="flex flex-1 items-start justify-center px-3.5 pb-10 pt-6 sm:items-center sm:px-6 sm:py-10 lg:py-12">
          <div className="w-full max-w-[980px]">
            <div className="mortgage-login-card grid overflow-hidden rounded-[1.5rem] bg-white sm:rounded-[1.85rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <div className="holistic-login-photo h-36 w-full sm:h-44 lg:hidden" />

              <div className="mx-auto flex w-full max-w-[420px] flex-col justify-between px-6 pb-7 pt-6 sm:px-9 sm:pb-9 sm:pt-9 lg:row-start-1 lg:max-w-none lg:px-10 lg:py-11">
                <Suspense fallback={<AuthCardFallback />}>
                  <LoginForm hecomOtpEnabled={serverEnv.authHecomOtpLogin} />
                </Suspense>
                <p className="mt-8 text-[11.5px] tracking-wide text-[#b0a89e] sm:mt-10">
                  © {new Date().getFullYear()} {siteConfig.companyName}
                </p>
              </div>

              <div className="relative hidden min-h-[560px] overflow-hidden lg:block">
                <div className="holistic-login-photo absolute inset-0" aria-hidden />
                <Image
                  src="/auth/login-side-waves.png"
                  alt=""
                  width={900}
                  height={1100}
                  priority
                  className="absolute inset-0 size-full object-cover object-[center_60%]"
                  sizes="(min-width: 1024px) 520px, 0px"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_252_248_/_0.72)_0%,rgb(255_252_248_/_0.18)_42%,transparent_68%)]"
                  aria-hidden
                />
                <LoginHeroPanel />
              </div>
            </div>
          </div>
        </main>

        <footer className="pointer-events-none px-5 pb-5 sm:px-8 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1080px] items-end justify-between gap-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c2bab0]">
            <p className="leading-5">
              Personas
              <br />
              Ideas
              <br />
              Resultados
            </p>
            <p className="text-right leading-5">Un marketing más humano</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
