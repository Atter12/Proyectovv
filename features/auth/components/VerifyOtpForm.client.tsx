"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { mapAuthErrorMessage } from "@/lib/auth/error-messages.client";
import { resolveSafeNextPath } from "@/lib/auth/safe-next-path";

async function assertAdminAccess(): Promise<boolean> {
  const response = await fetch(routes.api.auth.adminAccess, { cache: "no-store" });
  return response.ok;
}

const inputClassName =
  "h-12 w-full rounded-xl border border-[var(--auth-input-border)] bg-[var(--auth-bg)]/80 px-3.5 text-center text-[18px] tracking-[0.35em] text-[var(--auth-text)] placeholder:tracking-[0.35em] placeholder:text-[var(--auth-text-soft)] transition-[border-color,box-shadow,background-color] hover:border-[var(--auth-input-border-hover)] focus:border-[var(--auth-accent)]/80 focus:bg-[var(--auth-bg-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/25";

export function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";
  const isAdminContext = searchParams.get("context") === "admin";
  const isHecomFlow = searchParams.get("flow") === "hecom";
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
      setError("Falta el correo electrónico. Volvé al inicio de sesión.");
      setLoading(false);
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Introducí un código de 6 dígitos.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let verifyError = (
      await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: isHecomFlow ? "magiclink" : "email",
      })
    ).error;

    // Fallback: algunos proyectos validan el OTP de magiclink como type email.
    if (verifyError && isHecomFlow) {
      verifyError = (
        await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otp.trim(),
          type: "email",
        })
      ).error;
    }

    if (verifyError) {
      setError(mapAuthErrorMessage(verifyError.message));
      setLoading(false);
      return;
    }

    const flow = searchParams.get("flow");
    if (flow === "hecom") {
      try {
        await fetch(routes.api.auth.otpProvision, { method: "POST" });
      } catch {
        // El link Hecom se puede reintentar; no bloquear login.
      }
    }

    if (isAdminContext) {
      const allowed = await assertAdminAccess();
      router.push(allowed ? adminDestination : routes.adminUnauthorized);
      router.refresh();
      return;
    }

    const destination = resolveSafeNextPath(
      searchParams.get("next"),
      routes.overview,
    );
    router.push(destination);
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

    const flow = searchParams.get("flow");
    if (flow === "hecom") {
      try {
        const response = await fetch(routes.api.auth.otpRequest, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        const payload = (await response.json()) as { error?: string; message?: string };
        if (!response.ok) {
          setError(mapAuthErrorMessage(payload.error ?? "No se pudo reenviar."));
        } else {
          setSuccess(
            payload.message ??
              "Te enviamos un nuevo código y enlace mágico a tu correo.",
          );
        }
      } catch {
        setError("No se pudo reenviar el código.");
      }
      setResending(false);
      return;
    }

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
    <div className="auth-panel auth-enter relative w-full max-w-[420px] overflow-hidden rounded-[1.25rem] p-8 sm:p-9 lg:max-w-none">
      <div className="mb-8">
        <p className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)]">
          {siteConfig.name}
        </p>
        <h1 className="mt-2 text-[1.85rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2rem]">
          {isHecomFlow ? "Código o enlace" : "Verificá tu correo"}
        </h1>
        <p className="mt-2 text-[15px] font-medium leading-6 text-[var(--auth-text-muted)]">
          {isHecomFlow ? (
            <>
              Escribí el código de 6 dígitos enviado a{" "}
              <span className="font-semibold text-[var(--auth-text)]">
                {email || "tu correo"}
              </span>
              , o abrí el enlace mágico del mismo email.
            </>
          ) : (
            <>
              Introducí el código de 6 dígitos enviado a{" "}
              <span className="font-semibold text-[var(--auth-text)]">
                {email || "tu correo"}
              </span>
            </>
          )}
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label
            htmlFor="otp"
            className="mb-2 block text-[14px] font-medium text-[var(--auth-text-muted)]"
          >
            Código de verificación
          </label>
          <input
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
            className={inputClassName}
          />
        </div>

        {error && (
          <p
            className="rounded-xl border border-[var(--auth-danger)]/20 bg-[var(--auth-danger)]/[0.08] px-3.5 py-2.5 text-[14px] leading-5 text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-3.5 py-2.5 text-[14px] leading-5 text-emerald-100"
            role="status"
          >
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1.5 flex h-12 w-full items-center justify-center rounded-xl bg-[var(--auth-accent)] text-[15px] font-bold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
        >
          {loading ? "Verificando…" : "Verificar y continuar"}
        </button>
      </form>

      <div className="mt-6 space-y-3 border-t border-[var(--auth-divider)] pt-5 text-center text-[15px]">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className={cn(
            "font-semibold text-[var(--auth-accent)] transition-colors hover:text-[var(--brand-accent)] disabled:opacity-50",
          )}
        >
          {resending ? "Reenviando…" : "Reenviar código y enlace"}
        </button>
        <p className="text-[var(--auth-text-muted)]">
          <Link
            href={isAdminContext ? routes.adminLogin : routes.login}
            className="font-medium text-[var(--auth-text-soft)] transition-colors hover:text-[var(--auth-text)]"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
