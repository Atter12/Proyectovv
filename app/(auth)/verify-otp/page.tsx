import { Suspense } from "react";
import { VerifyOtpForm } from "@/features/auth/components/VerifyOtpForm.client";
import { AuthSplitShell } from "@/features/auth/components/AuthSplitShell";
import { routes } from "@/config/routes";
import { getAuthCopy } from "@/features/auth/i18n/auth-copy";
import { getLandingLocale } from "@/features/landing/i18n/landing-locale.server";

function AuthCardFallback() {
  return (
    <div className="w-full animate-pulse space-y-4 py-4">
      <div className="h-8 w-52 rounded-lg bg-[var(--auth-skeleton)]" />
      <div className="h-4 w-64 rounded bg-[var(--auth-skeleton)]" />
      <div className="h-[3.375rem] rounded-[14px] bg-[var(--auth-skeleton)]" />
      <div className="h-[3.375rem] rounded-[14px] bg-[var(--auth-skeleton)]" />
    </div>
  );
}

export default async function VerifyOtpPage() {
  const locale = await getLandingLocale();
  const copy = getAuthCopy(locale).verify;

  return (
    <AuthSplitShell
      locale={locale}
      topRight={{ label: copy.topRightLabel, href: routes.login }}
      caption={{
        title: copy.captionTitle,
        sub: copy.captionSub,
      }}
    >
      <Suspense fallback={<AuthCardFallback />}>
        <VerifyOtpForm locale={locale} />
      </Suspense>
    </AuthSplitShell>
  );
}
