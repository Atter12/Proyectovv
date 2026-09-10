import { Suspense } from "react";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm.client";
import { AuthSplitShell } from "@/features/auth/components/AuthSplitShell";
import { routes } from "@/config/routes";

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

export default function ForgotPasswordPage() {
  return (
    <AuthSplitShell
      topRight={{ label: "Volver al inicio", href: routes.login }}
      imagePosition="30% 58%"
      caption={{
        title: "Te ayudamos a recuperar el acceso.",
        sub: "Ads Holistic, la plataforma de Holistic Marketing.",
      }}
    >
      <Suspense fallback={<AuthCardFallback />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthSplitShell>
  );
}
