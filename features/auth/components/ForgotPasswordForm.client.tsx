"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { mapAuthErrorMessage } from "@/lib/auth/error-messages.client";

type RecoveryStep = "request" | "verify" | "reset" | "done";

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4056ff] via-[#6d5df8] to-[#7c3aed] text-[10px] font-bold text-white shadow-lg shadow-[#4056ff]/25 ring-1 ring-white/15">
        DM
      </div>
      <span className="text-sm font-semibold text-white">{siteConfig.name}</span>
    </div>
  );
}

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
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-200"
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
  "h-12 w-full rounded-2xl border border-white/10 bg-white/[0.065] px-4 text-sm text-white shadow-inner shadow-black/10 placeholder:text-slate-500 transition-all focus:border-[#8aa4ff]/60 focus:bg-white/[0.09] focus:outline-none focus:ring-4 focus:ring-[#4056ff]/15";

function StepPill({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "h-1.5 rounded-full transition-all",
        active ? "w-8 bg-[#12d6a3]" : "w-2 bg-white/20",
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
    <div className="luxury-card w-full max-w-[460px] rounded-[1.65rem] p-7 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#12d6a3]">
            Recuperación segura
          </p>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-white">
            Restablecer contraseña
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Verificaremos tu correo con un código OTP de 6 dígitos antes de permitir el cambio.
          </p>
        </div>
        <BrandMark />
      </div>

      <div className="mb-6 flex items-center gap-1.5" aria-label="Progreso del flujo">
        <StepPill active={["request", "verify", "reset", "done"].includes(step)}>1</StepPill>
        <StepPill active={["verify", "reset", "done"].includes(step)}>2</StepPill>
        <StepPill active={["reset", "done"].includes(step)}>3</StepPill>
      </div>

      {step === "request" && (
        <form onSubmit={handleRequest} className="space-y-5">
          <div>
            <label htmlFor="recovery-email" className="mb-2 block text-xs font-semibold text-slate-400">
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
            <p className="rounded-2xl border border-red-400/10 bg-red-500/10 px-3 py-2 text-xs text-red-200" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4056ff,#7c3aed)] text-sm font-bold text-white shadow-xl shadow-[#4056ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-[#4056ff]/35 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Enviando código…" : "Enviar código OTP"}
          </button>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={handleVerify} className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm text-slate-300">
            Enviamos el código a <span className="font-semibold text-white">{normalizedEmail}</span>.
          </div>

          <div>
            <label htmlFor="recovery-otp" className="mb-2 block text-xs font-semibold text-slate-400">
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
            <p className="rounded-2xl border border-red-400/10 bg-red-500/10 px-3 py-2 text-xs text-red-200" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-2xl border border-emerald-400/10 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200" role="status">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4056ff,#7c3aed)] text-sm font-bold text-white shadow-xl shadow-[#4056ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-[#4056ff]/35 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verificando…" : "Verificar código"}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="w-full text-center text-sm font-semibold text-[#8aa4ff] transition-colors hover:text-white disabled:opacity-50"
          >
            {resending ? "Reenviando…" : "Reenviar código"}
          </button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={handleResetPassword} className="space-y-5">
          <div>
            <label htmlFor="new-password" className="mb-2 block text-xs font-semibold text-slate-400">
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
            <label htmlFor="confirm-new-password" className="mb-2 block text-xs font-semibold text-slate-400">
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
              <PasswordToggle visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((prev) => !prev)} />
            </div>
          </div>

          {error && (
            <p className="rounded-2xl border border-red-400/10 bg-red-500/10 px-3 py-2 text-xs text-red-200" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-2xl border border-emerald-400/10 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200" role="status">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4056ff,#7c3aed)] text-sm font-bold text-white shadow-xl shadow-[#4056ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-[#4056ff]/35 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Actualizando…" : "Cambiar contraseña"}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-400/10 bg-emerald-500/10 p-4 text-sm leading-relaxed text-emerald-100">
            {success ?? "Contraseña actualizada correctamente."}
          </div>
          <Link
            href={routes.login}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4056ff,#7c3aed)] text-sm font-bold text-white shadow-xl shadow-[#4056ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-[#4056ff]/35"
          >
            Ir al inicio de sesión
          </Link>
        </div>
      )}

      <div className="mt-6 text-center text-sm text-slate-400">
        <Link href={routes.login} className="font-semibold text-[#8aa4ff] transition-colors hover:text-white hover:underline">
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
