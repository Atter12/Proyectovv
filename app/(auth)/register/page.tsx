import { Suspense } from "react";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/features/auth/components/RegisterForm.client";
import { AuthSplitShell } from "@/features/auth/components/AuthSplitShell";
import { routes } from "@/config/routes";
import { clerkLoginEnabled, clerkRoutes } from "@/lib/auth/clerk";
import { serverEnv } from "@/lib/env/env.server";

function AuthCardFallback() {
  return (
    <div className="w-full animate-pulse space-y-4 py-4">
      <div className="h-8 w-56 rounded-lg bg-[var(--auth-skeleton)]" />
      <div className="h-4 w-64 rounded bg-[var(--auth-skeleton)]" />
      <div className="h-[3.375rem] rounded-[14px] bg-[var(--auth-skeleton)]" />
      <div className="h-[3.375rem] rounded-[14px] bg-[var(--auth-skeleton)]" />
      <div className="h-[3.375rem] rounded-[14px] bg-[var(--auth-skeleton)]" />
    </div>
  );
}

/** Registro público OTP: crea cliente Hecom y envía código. */
export default function RegisterPage() {
  if (clerkLoginEnabled()) {
    redirect(clerkRoutes.signUp);
  }

  if (!serverEnv.authHecomOtpLogin) {
    redirect(routes.login);
  }

  return (
    <AuthSplitShell
      topRight={{ label: "Iniciar sesión", href: routes.login }}
      imagePosition="40% 40%"
      caption={{
        title: "Una sola cartera para todas tus cuentas.",
        sub: "Ads Holistic, la plataforma de Holistic Marketing.",
      }}
    >
      <Suspense fallback={<AuthCardFallback />}>
        <RegisterForm />
      </Suspense>
    </AuthSplitShell>
  );
}
