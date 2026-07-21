"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/client";
import { mapAuthErrorMessage } from "@/lib/auth/error-messages.client";
import { resolveSafeNextPath } from "@/lib/auth/safe-next-path";
import { EcomdyLogo } from "@/components/brand/EcomdyLogo";

async function assertAdminAccess(): Promise<boolean> {
  const response = await fetch(routes.api.auth.adminAccess, { cache: "no-store" });
  return response.ok;
}

export function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";
  const isAdminContext = searchParams.get("context") === "admin";
  const adminDestination = resolveSafeNextPath(
    searchParams.get("next"),
    routes.adminOverview,
    { requiredPrefix: "/admin" },
  );
  const [email] = useState(emailParam);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!email) {
      setError("Falta el correo electrónico. Vuelve al registro o al inicio de sesión.");
      setLoading(false);
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Introduce un código de 6 dígitos.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });

    if (verifyError) {
      setError(mapAuthErrorMessage(verifyError.message));
      setLoading(false);
      return;
    }

    if (isAdminContext) {
      const allowed = await assertAdminAccess();
      router.push(allowed ? adminDestination : routes.adminUnauthorized);
      router.refresh();
      return;
    }

    router.push(routes.overview);
    router.refresh();
  }

  async function handleResend() {
    if (!email) {
      setError("Falta el correo electrónico.");
      return;
    }

    setResending(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });

    if (resendError) {
      setError(mapAuthErrorMessage(resendError.message));
    } else {
      setSuccess("Te enviamos un nuevo código a tu correo.");
    }

    setResending(false);
  }

  return (
    <Card className="w-full max-w-md" padding="lg">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <EcomdyLogo size={48} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Verifica tu correo</h1>
        <p className="mt-2 text-sm text-slate-500">
          Introduce el código de 6 dígitos enviado a{" "}
          <span className="font-medium text-slate-700">{email || "tu correo"}</span>
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label htmlFor="otp" className="mb-1.5 block text-xs font-medium text-slate-600">
            Código de verificación
          </label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={otp}
            onChange={(event) =>
              setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="123456"
            className="text-center text-lg tracking-[0.35em]"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="text-xs text-green-600" role="status">
            {success}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Verificando…" : "Verificar y continuar"}
        </Button>
      </form>

      <div className="mt-4 space-y-2 text-center text-sm">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        >
          {resending ? "Reenviando…" : "Reenviar código"}
        </button>
        <p className="text-slate-500">
          <Link
            href={isAdminContext ? routes.adminLogin : routes.login}
            className="hover:text-slate-700"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        {siteConfig.name} — verificación por correo
      </p>
    </Card>
  );
}
