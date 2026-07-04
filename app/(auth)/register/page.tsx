import { Suspense } from "react";
import { RegisterForm } from "@/features/auth/components/RegisterForm.client";
import { RegisterHeroPanel } from "@/features/auth/components/RegisterHeroPanel";
import { siteConfig } from "@/config/site";

function AuthCardFallback() {
  return (
    <div className="w-full max-w-[460px] animate-pulse rounded-2xl border border-white/10 bg-[#141c2e]/80 p-8">
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-6 w-32 rounded bg-white/10" />
          <div className="h-4 w-48 rounded bg-white/10" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-white/10" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-11 rounded-xl bg-white/10" />
        <div className="h-11 rounded-xl bg-white/10" />
      </div>
      <div className="mt-4 h-11 rounded-xl bg-white/10" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="h-11 rounded-xl bg-white/10" />
        <div className="h-11 rounded-xl bg-white/10" />
      </div>
      <div className="mt-5 h-11 rounded-xl bg-[#4056ff]/30" />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070b1f]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_40%,rgba(64,86,255,0.18),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_20%,rgba(124,58,237,0.12),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.03) 75%, transparent 75%, transparent)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <div className="relative grid min-h-screen lg:grid-cols-2">
        <RegisterHeroPanel />

        <div className="flex min-h-screen flex-col items-center justify-center overflow-y-auto px-4 py-10 sm:px-6 lg:px-10 xl:px-16">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4056ff] to-[#7c3aed] text-xs font-bold text-white">
              DM
            </div>
            <p className="text-lg font-semibold text-white">{siteConfig.name}</p>
            <p className="mt-1 text-sm text-slate-400">Crea tu cuenta de anunciante</p>
          </div>

          <Suspense fallback={<AuthCardFallback />}>
            <RegisterForm />
          </Suspense>

          <p className="mt-8 text-xs text-slate-600">
            © {new Date().getFullYear()} {siteConfig.companyName}
          </p>
        </div>
      </div>
    </div>
  );
}
