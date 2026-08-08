import { Suspense } from "react";
import Link from "next/link";
import { VerifyOtpForm } from "@/features/auth/components/VerifyOtpForm.client";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import {
  LoginHeroPanel,
  LoginMobileIntro,
} from "@/features/auth/components/LoginHeroPanel";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";

function AuthCardFallback() {
  return (
    <div className="auth-panel w-full max-w-[400px] animate-pulse rounded-2xl p-8">
      <div className="mb-7 space-y-2">
        <div className="h-6 w-32 rounded bg-[var(--auth-skeleton)]" />
        <div className="h-4 w-48 rounded bg-[var(--auth-skeleton)]" />
      </div>
      <div className="space-y-4">
        <div className="h-12 rounded-xl bg-[var(--auth-skeleton)]" />
        <div className="h-12 rounded-xl bg-[var(--auth-accent)]/25" />
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <div className="auth-canvas auth-login-shell relative min-h-screen overflow-x-hidden">
      <div className="auth-login-orb auth-login-orb--a" aria-hidden />
      <div className="auth-login-orb auth-login-orb--b" aria-hidden />
      <div className="auth-login-orb auth-login-orb--c" aria-hidden />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-[var(--auth-divider)]/70 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-[3.75rem] w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:h-[4.25rem] sm:px-6 lg:px-8">
            <Link
              href={routes.home}
              aria-label={siteConfig.name}
              className="inline-flex shrink-0 items-center"
            >
              <AuthBrandMark
                tone="light"
                compact
                className="!w-auto max-w-[132px] sm:max-w-[168px]"
              />
            </Link>
            <Link
              href={routes.login}
              className="shrink-0 text-[0.8125rem] font-semibold text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-accent)] sm:text-[0.875rem]"
            >
              <span className="sm:hidden">Login</span>
              <span className="hidden sm:inline">Volver al login</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-4 py-7 sm:px-6 sm:py-12 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,400px)] lg:items-center lg:gap-16 lg:px-8 lg:py-16 xl:gap-[4.5rem]">
          <LoginHeroPanel />
          <div className="mx-auto flex w-full max-w-[420px] flex-col lg:mx-0 lg:max-w-none">
            <LoginMobileIntro />
            <Suspense fallback={<AuthCardFallback />}>
              <VerifyOtpForm />
            </Suspense>
            <p className="mt-5 text-center text-[12px] tracking-wide text-[var(--auth-text-soft)]">
              © {new Date().getFullYear()} {siteConfig.companyName}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
