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
    <div className="auth-panel w-full max-w-[420px] animate-pulse rounded-2xl p-8">
      <div className="mb-7 space-y-2">
        <div className="h-7 w-40 rounded bg-[var(--auth-skeleton)]" />
        <div className="h-4 w-56 rounded bg-[var(--auth-skeleton)]" />
      </div>
      <div className="space-y-4">
        <div className="h-12 rounded-xl bg-[var(--auth-skeleton)]" />
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
        <header className="border-b border-[var(--auth-divider)] bg-white/80 backdrop-blur-sm">
          <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between gap-4 px-4 sm:h-[4.25rem] sm:px-6 lg:px-8">
            <Link href={routes.home} aria-label={siteConfig.name}>
              <AuthBrandMark
                tone="light"
                compact
                className="!justify-start max-w-[140px] sm:max-w-[160px]"
              />
            </Link>
            <Link
              href={routes.home}
              className="text-[0.9rem] font-semibold text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-accent)]"
            >
              Volver al inicio
            </Link>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:px-8 xl:gap-16 xl:px-10">
          <LoginHeroPanel />

          <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 lg:flex-none lg:items-stretch lg:px-0 lg:py-14">
            <Suspense fallback={<AuthCardFallback />}>
              <LoginForm hecomOtpEnabled={serverEnv.authHecomOtpLogin} />
            </Suspense>

            <p className="mt-6 text-center text-[13px] tracking-wide text-[var(--auth-text-soft)] lg:text-left">
              © {new Date().getFullYear()} {siteConfig.companyName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
