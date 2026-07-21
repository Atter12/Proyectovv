import { Suspense } from "react";
import { AdminLoginForm } from "@/features/auth/components/AdminLoginForm.client";
import { AdminLoginHeroPanel } from "@/features/auth/components/AdminLoginHeroPanel.client";
import { siteConfig } from "@/config/site";
import { EcomdyLogo } from "@/components/brand/EcomdyLogo";

export const dynamic = "force-dynamic";

function AdminLoginFallback() {
  return (
    <div className="auth-panel w-full max-w-[420px] animate-pulse rounded-2xl p-8">
      <div className="mb-7 space-y-2">
        <div className="h-10 w-40 rounded-lg bg-white/10" />
        <div className="h-7 w-52 rounded bg-white/10" />
        <div className="h-4 w-56 rounded bg-white/10" />
      </div>
      <div className="space-y-4">
        <div className="h-12 rounded-xl bg-white/10" />
        <div className="h-12 rounded-xl bg-white/10" />
        <div className="h-12 rounded-xl bg-[var(--auth-accent)]/30" />
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="auth-canvas relative min-h-screen overflow-hidden">
      <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <AdminLoginHeroPanel className="hidden lg:relative lg:block lg:min-h-screen" />

        <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-10 xl:px-14">
          <div className="absolute inset-y-8 left-0 hidden w-px bg-gradient-to-b from-transparent via-white/12 to-transparent lg:block" />

          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <EcomdyLogo size={40} className="shadow-lg" />
            <div>
              <p className="text-[15px] font-semibold text-[var(--auth-text)]">
                {siteConfig.name}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
                Admin console
              </p>
            </div>
          </div>

          <Suspense fallback={<AdminLoginFallback />}>
            <AdminLoginForm />
          </Suspense>

          <p className="mt-6 text-center text-[13px] tracking-wide text-[var(--auth-text-muted)]">
            {siteConfig.companyName} — acceso restringido a operadores autorizados
          </p>
        </div>
      </div>
    </div>
  );
}
