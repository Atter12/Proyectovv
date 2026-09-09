import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/features/auth/components/RegisterForm.client";
import { RegisterHeroPanel } from "@/features/auth/components/RegisterHeroPanel";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { clerkLoginEnabled, clerkRoutes } from "@/lib/auth/clerk";
import { serverEnv } from "@/lib/env/env.server";

function AuthCardFallback() {
  return (
    <div className="w-full animate-pulse space-y-4 py-4">
      <div className="h-7 w-40 rounded bg-[var(--auth-skeleton)]" />
      <div className="h-4 w-56 rounded bg-[var(--auth-skeleton)]" />
      <div className="h-12 rounded-full bg-[var(--auth-skeleton)]" />
      <div className="h-12 rounded-full bg-[var(--auth-skeleton)]" />
      <div className="h-12 rounded-full bg-[var(--auth-accent)]/25" />
    </div>
  );
}

/** Registro público OTP → crea cliente Hecom + envía código. */
export default function RegisterPage() {
  if (clerkLoginEnabled()) {
    redirect(clerkRoutes.signUp);
  }

  if (!serverEnv.authHecomOtpLogin) {
    redirect(routes.login);
  }

  return (
    <div className="auth-canvas mortgage-login relative min-h-screen overflow-x-hidden">
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="px-4 pt-4 sm:px-6 sm:pt-5 lg:px-8">
          <div className="mx-auto flex w-full max-w-[930px] items-center justify-between gap-3">
            <Link
              href={routes.home}
              aria-label={siteConfig.name}
              className="inline-flex shrink-0 items-center"
            >
              <AuthBrandMark
                tone="light"
                compact
                className="!w-auto max-w-[120px] sm:max-w-[160px]"
              />
            </Link>
            <Link
              href={routes.login}
              className="shrink-0 rounded-full bg-[var(--auth-accent)] px-4 py-2 text-[0.8125rem] font-semibold text-white shadow-[0_8px_18px_rgb(255_120_31_/_0.25)] transition-[filter] hover:brightness-[1.05] sm:text-[0.875rem]"
            >
              Iniciar sesión
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-start justify-center px-3.5 pb-8 pt-5 sm:items-center sm:px-6 sm:py-12 lg:py-14">
          <div className="w-full max-w-[930px]">
            <div className="mortgage-login-card grid overflow-hidden rounded-[1.35rem] bg-white sm:rounded-[1.75rem] lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:p-2.5 lg:pl-0">
              <div className="h-36 w-full bg-[linear-gradient(135deg,#ff7a1f,#7c3aed)] sm:h-44 lg:hidden" />

              <div className="mx-auto flex w-full max-w-[400px] flex-col justify-center px-5 pb-7 pt-5 sm:px-8 sm:pb-10 sm:pt-8 lg:row-start-1 lg:px-8 lg:py-10">
                <Suspense fallback={<AuthCardFallback />}>
                  <RegisterForm />
                </Suspense>
                <p className="mt-6 text-center text-[11.5px] tracking-wide text-[var(--auth-text-soft)] sm:mt-8 sm:text-[12px] lg:text-left">
                  © {new Date().getFullYear()} {siteConfig.companyName}
                </p>
              </div>

              <div className="relative hidden min-h-[520px] overflow-hidden rounded-[1.25rem] lg:block">
                <RegisterHeroPanel />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
