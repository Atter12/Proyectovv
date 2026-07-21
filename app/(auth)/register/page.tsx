import { Suspense } from "react";
import { RegisterForm } from "@/features/auth/components/RegisterForm.client";
import { RegisterHeroPanel } from "@/features/auth/components/RegisterHeroPanel";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { AuthDotGridBackground } from "@/features/auth/components/AuthDotGridBackground.client";
import { siteConfig } from "@/config/site";

function AuthCardFallback() {
  return (
    <div className="auth-panel w-full max-w-[440px] animate-pulse rounded-2xl p-8">
      <div className="mb-7 space-y-2">
        <div className="h-7 w-40 rounded bg-white/10" />
        <div className="h-4 w-56 rounded bg-white/10" />
      </div>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-12 rounded-xl bg-white/10" />
          <div className="h-12 rounded-xl bg-white/10" />
        </div>
        <div className="h-12 rounded-xl bg-white/10" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-12 rounded-xl bg-white/10" />
          <div className="h-12 rounded-xl bg-white/10" />
        </div>
        <div className="h-12 rounded-xl bg-[var(--auth-accent)]/30" />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="auth-canvas relative min-h-screen overflow-hidden">
      <AuthDotGridBackground />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1180px] flex-col lg:grid lg:grid-cols-[1fr_440px] lg:items-center lg:gap-8 lg:px-8 xl:gap-10 xl:px-10">
        <RegisterHeroPanel />

        <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:flex-none lg:items-stretch lg:px-0 lg:py-10">
          <div className="mb-6 lg:hidden">
            <AuthBrandMark />
          </div>

          <Suspense fallback={<AuthCardFallback />}>
            <RegisterForm />
          </Suspense>

          <p className="mt-5 text-center text-[13px] tracking-wide text-[var(--auth-text-muted)] lg:text-left">
            © {new Date().getFullYear()} {siteConfig.companyName}
          </p>
        </div>
      </div>
    </div>
  );
}
