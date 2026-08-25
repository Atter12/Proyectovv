import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { ClerkMountGate } from "@/features/auth/components/ClerkMountGate.client";
import { clerkConfigured, clerkRoutes } from "@/lib/auth/clerk";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

export default function ClerkSignInPage() {
  if (!clerkConfigured()) {
    return (
      <main className="auth-canvas flex min-h-screen flex-col items-center justify-center px-4">
        <h1 className="font-display text-xl font-bold text-[var(--auth-text)]">
          Clerk no configurado
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-[var(--auth-text-muted)]">
          Faltan <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> y{" "}
          <code>CLERK_SECRET_KEY</code> en el entorno.
        </p>
        <Link
          href={routes.login}
          className="mt-6 text-sm font-semibold text-[var(--auth-accent)]"
        >
          ← Volver al login
        </Link>
      </main>
    );
  }

  return (
    <div className="auth-canvas mortgage-login relative min-h-screen overflow-x-hidden">
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="mx-auto flex w-full max-w-[480px] items-center justify-between">
            <Link href={routes.home} aria-label={siteConfig.name}>
              <AuthBrandMark tone="light" compact className="!w-auto max-w-[140px]" />
            </Link>
            <Link
              href={routes.home}
              className="text-[0.8125rem] font-semibold text-[var(--auth-text-muted)]"
            >
              Inicio
            </Link>
          </div>
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-6 sm:items-center">
          <div className="w-full max-w-[420px]">
            <ClerkMountGate>
              <SignIn
                routing="path"
                path={clerkRoutes.signIn}
                signUpUrl={clerkRoutes.signUp}
                forceRedirectUrl={clerkRoutes.complete}
                fallbackRedirectUrl={clerkRoutes.complete}
              />
            </ClerkMountGate>
          </div>
        </main>
      </div>
    </div>
  );
}
