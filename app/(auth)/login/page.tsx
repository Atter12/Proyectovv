import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/LoginForm.client";
import { AuthSplitShell } from "@/features/auth/components/AuthSplitShell";
import { routes } from "@/config/routes";
import { clerkLoginEnabled, clerkRoutes } from "@/lib/auth/clerk";
import { serverEnv } from "@/lib/env/env.server";

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

export default function LoginPage() {
  if (clerkLoginEnabled()) {
    redirect(clerkRoutes.signIn);
  }

  return (
    <AuthSplitShell
      topRight={{ label: "Crear cuenta", href: routes.register }}
      caption={{
        title: "Recarga en soles. Pauta en dólares.",
        sub: "Ads Holistic, la plataforma de Holistic Marketing.",
      }}
    >
      <Suspense fallback={<AuthCardFallback />}>
        <LoginForm hecomOtpEnabled={serverEnv.authHecomOtpLogin} />
      </Suspense>
    </AuthSplitShell>
  );
}
