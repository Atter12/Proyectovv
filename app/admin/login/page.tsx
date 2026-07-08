import { Suspense } from "react";
import { AdminLoginForm } from "@/features/auth/components/AdminLoginForm.client";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

function AdminLoginFallback() {
  return (
    <div className="w-full max-w-[420px] animate-pulse rounded-[1.35rem] border border-[var(--admin-border)] bg-[var(--admin-sidebar-panel)] p-8">
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
    <div className="admin-canvas grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <Suspense fallback={<AdminLoginFallback />}>
          <AdminLoginForm />
        </Suspense>
        <p className="mt-6 text-center text-xs text-[var(--admin-text-soft)]">
          {siteConfig.companyName} — acceso restringido a operadores autorizados
        </p>
      </div>
    </div>
  );
}
