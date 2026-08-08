import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { VerifyOtpForm } from "@/features/auth/components/VerifyOtpForm.client";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";

function AuthCardFallback() {
  return (
    <div className="w-full animate-pulse space-y-4 py-4">
      <div className="h-7 w-40 rounded bg-[var(--auth-skeleton)]" />
      <div className="h-4 w-56 rounded bg-[var(--auth-skeleton)]" />
      <div className="h-12 rounded-full bg-[var(--auth-skeleton)]" />
      <div className="h-12 rounded-full bg-[var(--auth-accent)]/25" />
    </div>
  );
}

export default function VerifyOtpPage() {
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
              className="shrink-0 rounded-full px-2 py-1.5 text-[0.8125rem] font-semibold text-[var(--auth-text-muted)] transition-colors hover:bg-white/70 hover:text-[var(--auth-accent)] sm:text-[0.875rem]"
            >
              <span className="sm:hidden">Login</span>
              <span className="hidden sm:inline">Volver al login</span>
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-start justify-center px-3.5 pb-8 pt-5 sm:items-center sm:px-6 sm:py-12 lg:py-14">
          <div className="w-full max-w-[930px]">
            <div className="mortgage-login-card grid overflow-hidden rounded-[1.35rem] bg-white sm:rounded-[1.75rem] lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:p-2.5 lg:pl-0">
              <div
                className="mortgage-login-photo h-40 w-full sm:h-48 lg:hidden"
                role="img"
                aria-label=""
              />

              <div className="mx-auto flex w-full max-w-[400px] flex-col justify-center px-5 pb-7 pt-5 sm:px-8 sm:pb-10 sm:pt-8 lg:row-start-1 lg:px-8 lg:py-12">
                <Suspense fallback={<AuthCardFallback />}>
                  <VerifyOtpForm />
                </Suspense>
                <p className="mt-6 text-center text-[11.5px] tracking-wide text-[var(--auth-text-soft)] sm:mt-8 sm:text-[12px] lg:text-left">
                  © {new Date().getFullYear()} {siteConfig.companyName}
                </p>
              </div>

              <div className="relative hidden min-h-[520px] overflow-hidden rounded-[1.25rem] lg:block">
                <div
                  className="mortgage-login-photo absolute inset-0"
                  aria-hidden
                />
                <Image
                  src="/auth/login-side.jpg"
                  alt=""
                  width={912}
                  height={1040}
                  priority
                  className="absolute inset-0 size-full object-cover"
                  sizes="(min-width: 1024px) 500px, 0px"
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
