import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm.client";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { serverEnv } from "@/lib/env/env.server";

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

/**
 * Login — mortgage-services layout, imagen lifestyle + móvil cómodo.
 */
export default function LoginPage() {
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
              href={routes.home}
              className="shrink-0 rounded-full px-2 py-1.5 text-[0.8125rem] font-semibold text-[var(--auth-text-muted)] transition-colors hover:bg-white/70 hover:text-[var(--auth-accent)] sm:text-[0.875rem]"
            >
              <span className="sm:hidden">Inicio</span>
              <span className="hidden sm:inline">Volver al inicio</span>
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-start justify-center px-3.5 pb-8 pt-5 sm:items-center sm:px-6 sm:py-12 lg:py-14">
          <div className="w-full max-w-[930px]">
            <div className="mortgage-login-card overflow-hidden rounded-[1.35rem] bg-white sm:rounded-[1.75rem] lg:flex lg:items-stretch lg:py-2.5 lg:pr-2.5">
              {/* Banner móvil — foto corta, sin overlay pesado */}
              <figure className="relative h-36 w-full overflow-hidden sm:h-44 lg:hidden">
                <Image
                  src="/auth/login-side.jpg"
                  alt=""
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover object-[center_35%]"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent"
                  aria-hidden
                />
              </figure>

              <div className="mx-auto flex w-full max-w-[400px] flex-col justify-center px-5 pb-7 pt-5 sm:px-8 sm:pb-10 sm:pt-8 lg:shrink-0 lg:py-14">
                <Suspense fallback={<AuthCardFallback />}>
                  <LoginForm hecomOtpEnabled={serverEnv.authHecomOtpLogin} />
                </Suspense>
                <p className="mt-6 text-center text-[11.5px] tracking-wide text-[var(--auth-text-soft)] sm:mt-8 sm:text-[12px] lg:text-left">
                  © {new Date().getFullYear()} {siteConfig.companyName}
                </p>
              </div>

              {/* Lateral desktop — foto mortgage, sin texto encima */}
              <figure className="relative hidden min-h-[540px] flex-1 overflow-hidden rounded-[1.25rem] lg:block">
                <Image
                  src="/auth/login-side.jpg"
                  alt={`${siteConfig.name}`}
                  fill
                  priority
                  sizes="(min-width: 1024px) 456px, 0px"
                  className="object-cover object-center"
                />
              </figure>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
