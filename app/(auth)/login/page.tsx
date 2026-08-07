import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm.client";
import { LoginHeroPanel } from "@/features/auth/components/LoginHeroPanel";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { serverEnv } from "@/lib/env/env.server";

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

export default function LoginPage() {
  return (
    <div className="auth-canvas relative min-h-screen overflow-x-hidden">
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-[var(--auth-divider)] bg-white">
          <div className="relative h-[4.25rem] w-full">
            {/* Logo 100% al centro de la pantalla */}
            <Link
              href={routes.home}
              aria-label={siteConfig.name}
              className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
            >
              <AuthBrandMark
                tone="light"
                compact
                className="!w-auto max-w-[150px] sm:max-w-[168px]"
              />
            </Link>
            <Link
              href={routes.home}
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-[0.875rem] font-semibold text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-accent)] sm:right-8"
            >
              Volver al inicio
            </Link>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-4 py-10 sm:px-6 sm:py-12 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:gap-14 lg:px-8 lg:py-16 xl:gap-16">
          <LoginHeroPanel />

          <div className="flex w-full flex-col items-center lg:items-stretch">
            <Suspense fallback={<AuthCardFallback />}>
              <LoginForm hecomOtpEnabled={serverEnv.authHecomOtpLogin} />
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
