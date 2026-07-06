import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm.client";
import { LoginHeroPanel } from "@/features/auth/components/LoginHeroPanel";
import { siteConfig } from "@/config/site";

function AuthCardFallback() {
  return (
    <div className="w-full max-w-[430px] animate-pulse rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="mb-8 flex items-center justify-between">
        <div className="h-6 w-28 rounded bg-white/10" />
        <div className="h-8 w-24 rounded-lg bg-white/10" />
      </div>
      <div className="space-y-5">
        <div className="h-11 rounded-2xl bg-white/10" />
        <div className="h-11 rounded-2xl bg-white/10" />
        <div className="h-11 rounded-2xl bg-[#4056ff]/30" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-luxury-canvas relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#f6c76b]/10 blur-3xl" aria-hidden />
      <div className="relative grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <LoginHeroPanel />

        <div className="relative flex flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-10 xl:px-16">
          <div className="absolute inset-y-10 left-0 hidden w-px bg-gradient-to-b from-transparent via-white/12 to-transparent lg:block" />

          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4056ff] to-[#7c3aed] text-xs font-bold text-white shadow-xl shadow-[#4056ff]/25">
              DM
            </div>
            <p className="text-lg font-semibold text-white">{siteConfig.name}</p>
          </div>

          <Suspense fallback={<AuthCardFallback />}>
            <LoginForm />
          </Suspense>

          <p className="mt-8 text-xs text-slate-500">
            © {new Date().getFullYear()} {siteConfig.companyName}. Plataforma segura para operaciones publicitarias.
          </p>
        </div>
      </div>
    </div>
  );
}
