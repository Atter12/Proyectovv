import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm.client";
import { LoginHeroPanel } from "@/features/auth/components/LoginHeroPanel";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { AuthDotGridBackground } from "@/features/auth/components/AuthDotGridBackground.client";
import { siteConfig } from "@/config/site";

function AuthCardFallback() {
  return (
    <div className="auth-panel w-full max-w-[420px] animate-pulse rounded-[var(--auth-radius-lg)] p-8">
      <div className="mb-8 space-y-2">
        <div className="h-7 w-40 rounded bg-white/10" />
        <div className="h-4 w-52 rounded bg-white/10" />
      </div>
      <div className="space-y-4">
        <div className="h-11 rounded-[var(--auth-radius)] bg-white/10" />
        <div className="h-11 rounded-[var(--auth-radius)] bg-white/10" />
        <div className="h-11 rounded-[var(--auth-radius)] bg-[var(--auth-accent)]/30" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-canvas relative min-h-screen overflow-hidden">
      <AuthDotGridBackground />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <LoginHeroPanel />

        <div className="relative flex flex-col items-center justify-center px-4 py-10 sm:px-6 lg:border-l lg:border-white/[0.06] lg:px-10 xl:px-16">
          <div className="mb-8 lg:hidden">
            <AuthBrandMark />
          </div>

          <Suspense fallback={<AuthCardFallback />}>
            <LoginForm />
          </Suspense>

          <p className="mt-8 text-center text-xs text-[var(--auth-text-soft)]">
            © {new Date().getFullYear()} {siteConfig.companyName}
          </p>
        </div>
      </div>
    </div>
  );
}
