import { Suspense } from "react";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/features/auth/components/RegisterForm.client";
import { AuthSplitShell } from "@/features/auth/components/AuthSplitShell";
import { routes } from "@/config/routes";
import { clerkLoginEnabled, clerkRoutes } from "@/lib/auth/clerk";
import { serverEnv } from "@/lib/env/env.server";
import { getAuthCopy } from "@/features/auth/i18n/auth-copy";
import { getLandingLocale } from "@/features/landing/i18n/landing-locale.server";

function AuthCardFallback() {
  return (
    <div className="w-full animate-pulse space-y-4 py-4">
      <div className="h-8 w-56 rounded-lg bg-[var(--auth-skeleton)]" />
      <div className="h-4 w-64 rounded bg-[var(--auth-skeleton)]" />
      <div className="h-[3.375rem] rounded-[14px] bg-[var(--auth-skeleton)]" />
      <div className="h-[3.375rem] rounded-[14px] bg-[var(--auth-skeleton)]" />
      <div className="h-[3.375rem] rounded-[14px] bg-[var(--auth-skeleton)]" />
    </div>
  );
}

/** Registro público OTP: crea cliente Hecom y envía código. */
export default async function RegisterPage() {
  if (clerkLoginEnabled()) {
    redirect(clerkRoutes.signUp);
  }

  if (!serverEnv.authHecomOtpLogin) {
    redirect(routes.login);
  }

  const locale = await getLandingLocale();
  const copy = getAuthCopy(locale).register;

  return (
    <AuthSplitShell
      locale={locale}
      liveCompact
      topRight={{ label: copy.topRightLabel, href: routes.login }}
      caption={{
        title: copy.captionTitle,
        sub: copy.captionSub,
      }}
    >
      <Suspense fallback={<AuthCardFallback />}>
        <RegisterForm locale={locale} />
      </Suspense>
    </AuthSplitShell>
  );
}
