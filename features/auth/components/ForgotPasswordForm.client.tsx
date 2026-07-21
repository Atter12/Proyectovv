"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { mapAuthErrorMessage } from "@/lib/auth/error-messages.client";

type RecoveryStep = "request" | "verify" | "reset" | "done";

function PasswordToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--auth-text-soft)] transition-colors hover:bg-white/[0.05] hover:text-[var(--auth-text)]"
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
    >
      {visible ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )}
    </button>
  );
}

const inputClassName =
  "h-12 w-full rounded-xl border border-white/[0.1] bg-[var(--auth-bg)]/80 px-3.5 text-[15px] text-[var(--auth-text)] placeholder:text-[var(--auth-text-soft)] transition-[border-color,box-shadow,background-color] hover:border-white/[0.16] focus:border-[var(--auth-accent)]/80 focus:bg-[var(--auth-bg-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/25";

const primaryButtonClassName =
  "flex h-12 w-full items-center justify-center rounded-xl bg-[var(--auth-accent)] text-[15px] font-semibold text-white transition-[background-color,box-shadow,transform] hover:bg-[var(--auth-accent-hover)] hover:shadow-[0_10px_28px_rgb(23_139_255_/_0.32)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none";

function StepPill({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "h-1.5 rounded-full transition-all",
        active ? "w-8 bg-[var(--auth-accent)]" : "w-2 bg-white/20",
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<RecoveryStep>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  useEffect(() => {
    let active = true;

    async function detectRecoveryLinkSession() {
      const hasRecoveryHash =
        typeof window !== "undefined" &&
        window.location.hash.includes("type=recovery");

      if (!hasRecoveryHash) return;

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active || !session) return;

      setSuccess("Acceso verificado desde el enlace de recuperación. Crea tu nueva contraseña.");
      setStep("reset");
    }

    void detectRecoveryLinkSession();

    return () => {
      active = false;
    };
  }, []);

  async function sendRecoveryOtp() {
    if (!normalizedEmail) {
      setError("Ingresa tu correo electrónico para enviar el código.");
      return false;
    }

    const supabase = createClient();
    const redirectTo = `${window.location.origin}${routes.forgotPassword}`;
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo },
    );

    if (sendError) {
      setError(mapAuthErrorMessage(sendError.message));
      return false;
    }

    return true;
  }

  async function handleRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const sent = await sendRecoveryOtp();
    if (sent) {
      setSuccess("Te enviamos un código de 6 dígitos a tu correo.");
      setStep("verify");
    }

    setLoading(false);
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    setSuccess(null);

    const sent = await sendRecoveryOtp();
    if (sent) setSuccess("Código reenviado. Revisa tu bandeja de entrada.");

    setResending(false);
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Introduce el código de 6 dígitos.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: otp.trim(),
      type: "recovery",
    });

    if (verifyError) {
      setError(mapAuthErrorMessage(verifyError.message));
      setLoading(false);
      return;
    }

    setSuccess("Correo verificado. Ahora crea una nueva contraseña.");
    setStep("reset");
    setLoading(false);
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (password.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(mapAuthErrorMessage(updateError.message));
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setPassword("");
    setConfirmPassword("");
    setSuccess("Contraseña actualizada. Ya puedes iniciar sesión con tu nueva clave.");
    setStep("done");
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="auth-panel auth-enter relative w-full max-w-[420px] overflow-hidden rounded-2xl p-7 sm:p-8 lg:max-w-none">
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--auth-accent)]/55 to-transparent"
        aria-hidden
      />

      <div className="mb-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
          Recuperación
        </p>
        <h1 className="font-display mt-2.5 text-[1.85rem] leading-none tracking-tight text-[var(--auth-text)] sm:text-[2rem]">
          Restablecer contraseña
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-[var(--auth-text-muted)]">
          Verificamos tu correo con un código de 6 dígitos antes del cambio.
        </p>
      </div>

      <div className="mb-5 flex items-center gap-1.5" aria-label="Progreso del flujo">
        <StepPill active={["request", "verify", "reset", "done"].includes(step)}>1</StepPill>
        <StepPill active={["verify", "reset", "done"].includes(step)}>2</StepPill>
        <StepPill active={["reset", "done"].includes(step)}>3</StepPill>
      </div>

      {step === "request" && (
        <form onSubmit={handleRequest} className="space-y-4">
          <div>
            <label
              htmlFor="recovery-email"
              className="mb-2 block text-[14px] font-medium text-[var(--auth-text-muted)]"
            >
              Correo electrónico
            </label>
            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@empresa.com"
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

          <button type="submit" disabled={loading} className={primaryButtonClassName}>
            {loading ? "Enviando código…" : "Enviar código OTP"}
          </button>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-3 text-[14px] text-[var(--auth-text-muted)]">
            Enviamos el código a{" "}
            <span className="font-semibold text-[var(--auth-text)]">{normalizedEmail}</span>.
          </div>

          <div>
            <label
              htmlFor="recovery-otp"
              className="mb-2 block text-[14px] font-medium text-[var(--auth-text-muted)]"
            >
              Código de 6 dígitos
            </label>
            <input
              id="recovery-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className={cn(inputClassName, "text-center text-lg tracking-[0.35em]")}
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
              className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-2.5 text-[14px] leading-5 text-emerald-200"
              role="status"
            >
              {success}
            </p>
          )}

          <button type="submit" disabled={loading} className={primaryButtonClassName}>
            {loading ? "Verificando…" : "Verificar código"}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="w-full text-center text-[14px] font-semibold text-[var(--auth-accent)] transition-colors hover:text-[#7cc3ff] disabled:opacity-50"
          >
            {resending ? "Reenviando…" : "Reenviar código"}
          </button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label
              htmlFor="new-password"
              className="mb-2 block text-[14px] font-medium text-[var(--auth-text-muted)]"
            >
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 8 caracteres"
                className={cn(inputClassName, "pr-11")}
              />
              <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((prev) => !prev)} />
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm-new-password"
              className="mb-2 block text-[14px] font-medium text-[var(--auth-text-muted)]"
            >
              Confirmar nueva contraseña
            </label>
            <div className="relative">
              <input
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repite la nueva contraseña"
                className={cn(inputClassName, "pr-11")}
              />
              <PasswordToggle
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((prev) => !prev)}
              />
            </div>
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
              className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-2.5 text-[14px] leading-5 text-emerald-200"
              role="status"
            >
              {success}
            </p>
          )}

          <button type="submit" disabled={loading} className={primaryButtonClassName}>
            {loading ? "Actualizando…" : "Cambiar contraseña"}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-[14px] leading-6 text-emerald-100">
            {success ?? "Contraseña actualizada correctamente."}
          </div>
          <Link href={routes.login} className={primaryButtonClassName}>
            Ir al inicio de sesión
          </Link>
        </div>
      )}

      <div className="mt-6 border-t border-white/[0.07] pt-5 text-center text-[15px] text-[var(--auth-text-muted)]">
        <Link
          href={routes.login}
          className="font-semibold text-[var(--auth-accent)] transition-colors hover:text-[#7cc3ff]"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
