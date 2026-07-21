import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm.client";
import { LoginHeroPanel } from "@/features/auth/components/LoginHeroPanel";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { AuthDotGridBackground } from "@/features/auth/components/AuthDotGridBackground.client";
import { siteConfig } from "@/config/site";

function AuthCardFallback() {
  return (
    <div className="auth-panel w-full max-w-[380px] animate-pulse rounded-[14px] p-6">
      <div className="mb-6 space-y-2">
        <div className="h-6 w-36 rounded bg-white/10" />
        <div className="h-3.5 w-48 rounded bg-white/10" />
      </div>
      <div className="space-y-3.5">
        <div className="h-10 rounded-[10px] bg-white/10" />
        <div className="h-10 rounded-[10px] bg-white/10" />
        <div className="h-10 rounded-[10px] bg-[var(--auth-accent)]/30" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-canvas relative min-h-screen overflow-hidden">
      <AuthDotGridBackground />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1080px] flex-col lg:grid lg:grid-cols-[1fr_360px] lg:items-center lg:gap-10 lg:px-8 xl:gap-12 xl:px-10">
        <LoginHeroPanel />

        <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:flex-none lg:items-stretch lg:px-0 lg:py-10">
          <div className="mb-6 lg:hidden">
            <AuthBrandMark />
          </div>

          <Suspense fallback={<AuthCardFallback />}>
            <LoginForm />
          </Suspense>

          <p className="mt-5 text-center text-[11px] tracking-wide text-[var(--auth-text-muted)] lg:text-left">
            © {new Date().getFullYear()} {siteConfig.companyName}
          </p>
        </div>
      </div>
    </div>
  );
}
