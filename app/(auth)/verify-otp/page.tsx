import { Suspense } from "react";
import Link from "next/link";
import { VerifyOtpForm } from "@/features/auth/components/VerifyOtpForm.client";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { LoginHeroPanel } from "@/features/auth/components/LoginHeroPanel";
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
    <div className="auth-canvas relative min-h-screen overflow-x-hidden">
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-[var(--auth-divider)] bg-white">
          <div className="relative mx-auto flex h-[4.25rem] w-full max-w-[1100px] items-center justify-center px-4 sm:px-6">
            <Link href={routes.home} aria-label={siteConfig.name}>
              <AuthBrandMark
                tone="light"
                compact
                className="max-w-[148px] sm:max-w-[160px]"
              />
            </Link>
            <Link
              href={routes.login}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[0.875rem] font-semibold text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-accent)] sm:right-6"
            >
              Volver al login
            </Link>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-4 py-10 sm:px-6 sm:py-12 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:gap-14 lg:px-8 lg:py-16 xl:gap-16">
          <LoginHeroPanel />
          <div className="flex w-full flex-col items-center lg:items-stretch">
            <Suspense fallback={<AuthCardFallback />}>
              <VerifyOtpForm />
            </Suspense>
            <p className="mt-5 text-center text-[12px] tracking-wide text-[var(--auth-text-soft)] lg:text-left">
              © {new Date().getFullYear()} {siteConfig.companyName}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
