import { Suspense } from "react";
import { AdminLoginForm } from "@/features/auth/components/AdminLoginForm.client";
import { AdminLoginHeroPanel } from "@/features/auth/components/AdminLoginHeroPanel.client";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

function AdminLoginFallback() {
  return (
    <div className="w-full max-w-[420px] animate-pulse rounded-[1.35rem] border border-[var(--admin-border)] bg-[rgba(9,31,45,0.88)] p-8 backdrop-blur-xl">
      <div className="mb-6 h-10 w-40 rounded-lg bg-white/10" />
      <div className="space-y-4">
        <div className="h-11 rounded-xl bg-white/10" />
        <div className="h-11 rounded-xl bg-white/10" />
        <div className="h-11 rounded-xl bg-[var(--admin-accent)]/30" />
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="admin-login-canvas relative min-h-screen overflow-hidden">
      <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <AdminLoginHeroPanel className="absolute inset-0 lg:relative lg:min-h-screen" />

        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-10 xl:px-14">
          <div className="absolute inset-y-8 left-0 hidden w-px bg-gradient-to-b from-transparent via-white/12 to-transparent lg:block" />

          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--admin-accent)] text-sm font-black text-[#082131] shadow-lg">VV</span>
            <div>
              <p className="text-sm font-bold text-white">{siteConfig.name}</p>
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em] text-[#9af7c9]">Admin console</p>
            </div>
          </div>

          <Suspense fallback={<AdminLoginFallback />}>
            <AdminLoginForm />
          </Suspense>

          <p className="mt-6 text-center text-xs text-[#9ab7c8]">
            {siteConfig.companyName} — acceso restringido a operadores autorizados
          </p>
        </div>
      </div>
    </div>
  );
}
