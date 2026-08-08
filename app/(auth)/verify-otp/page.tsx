import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { VerifyOtpForm } from "@/features/auth/components/VerifyOtpForm.client";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";

function AuthCardFallback() {
  return (
    <div className="w-full max-w-[400px] animate-pulse space-y-4 px-2 py-6">
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
        <header className="px-4 pt-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[930px] items-center justify-between gap-3">
            <Link
              href={routes.home}
              aria-label={siteConfig.name}
              className="inline-flex shrink-0 items-center"
            >
              <AuthBrandMark
                tone="light"
                compact
                className="!w-auto max-w-[132px] sm:max-w-[160px]"
              />
            </Link>
            <Link
              href={routes.login}
              className="text-[0.8125rem] font-semibold text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-accent)] sm:text-[0.875rem]"
            >
              Volver al login
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
          <div className="w-full max-w-[930px]">
            <div className="mortgage-login-card flex items-stretch overflow-hidden rounded-[1.75rem] bg-white py-2.5 pr-2.5 max-lg:pr-0 max-lg:py-0">
              <div className="flex w-full max-w-[400px] flex-col justify-center px-6 py-10 sm:px-8 sm:py-14 lg:shrink-0">
                <Suspense fallback={<AuthCardFallback />}>
                  <VerifyOtpForm />
                </Suspense>
                <p className="mt-8 text-center text-[12px] tracking-wide text-[var(--auth-text-soft)] lg:text-left">
                  © {new Date().getFullYear()} {siteConfig.companyName}
                </p>
              </div>

              <figure className="relative hidden min-h-[520px] flex-1 overflow-hidden rounded-[1.25rem] lg:block">
                <Image
                  src="/auth/login-side-holistic.png"
                  alt={`${siteConfig.name} — panel de operación`}
                  fill
                  priority
                  sizes="456px"
                  className="object-cover object-top"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-[rgb(28_25_23_/_0.45)] via-transparent to-transparent"
                  aria-hidden
                />
                <figcaption className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[rgb(255_200_150)]">
                    Acceso seguro
                  </p>
                  <p className="mt-1.5 text-[1.05rem] font-semibold leading-snug tracking-[-0.02em]">
                    Código de 6 dígitos o enlace mágico en tu correo.
                  </p>
                </figcaption>
              </figure>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
