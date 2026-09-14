"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { mapAuthErrorMessage } from "@/lib/auth/error-messages.client";
import {
  AuthCodeInput,
  AuthFormHeading,
  AuthNotice,
  AuthSubmitButton,
} from "./AuthFormUi";
import styles from "./auth.module.css";

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
      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--auth-text-muted)] transition-colors hover:bg-[var(--auth-control-hover)] hover:text-[var(--auth-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-accent)]"
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

const inputClassName = cn("auth-field", styles.passwordField);

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

  const titles: Record<RecoveryStep, string> = {
    request: "Recupera tu acceso",
    verify: "Revisa tu correo",
    reset: "Crea una nueva contraseña",
    done: "Tu contraseña está lista",
  };

  return (
    <div className="w-full">
      <AuthFormHeading title={titles[step]}>
        {step === "request" && "Escribe el correo de tu cuenta. Te enviaremos un código para restablecer tu contraseña."}
        {step === "verify" && (
          <>Enviamos un código de 6 dígitos a <strong className={styles.destinationEmail}>{normalizedEmail}</strong></>
        )}
        {step === "reset" && "Tu correo está verificado. Elige una contraseña de al menos 8 caracteres."}
        {step === "done" && "Ya puedes volver a tu cuenta con tu nueva contraseña."}
      </AuthFormHeading>

      {step !== "done" && (
        <p className={cn(styles.helpText, "mb-5")} aria-live="polite">
          Paso {step === "request" ? "1" : step === "verify" ? "2" : "3"} de 3
        </p>
      )}

      {step === "request" && (
        <form onSubmit={handleRequest} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="recovery-email" className={styles.fieldLabel}>Correo electrónico</label>
            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@empresa.com"
              className={inputClassName}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "recovery-error" : undefined}
            />
          </div>
          {error && <AuthNotice tone="error" id="recovery-error">{error}</AuthNotice>}
          <AuthSubmitButton loading={loading} loadingLabel="Enviando código…">Enviar código</AuthSubmitButton>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={handleVerify} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="recovery-otp" className={styles.fieldLabel}>Código de 6 dígitos</label>
            <AuthCodeInput
              id="recovery-otp"
              value={otp}
              onChange={setOtp}
              disabled={loading}
              invalid={Boolean(error)}
              describedBy={error ? "recovery-error" : "recovery-code-help"}
            />
            <p id="recovery-code-help" className={styles.helpText}>Puedes copiar y pegar el código completo.</p>
          </div>
          {error && <AuthNotice tone="error" id="recovery-error">{error}</AuthNotice>}
          {success && <AuthNotice tone="success">{success}</AuthNotice>}
          <AuthSubmitButton loading={loading} loadingLabel="Verificando código…">Verificar código</AuthSubmitButton>
          <button type="button" onClick={handleResend} disabled={resending} className={styles.secondaryButton}>
            {resending ? "Reenviando…" : "Reenviar código"}
          </button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={handleResetPassword} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="new-password" className={styles.fieldLabel}>Nueva contraseña</label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 8 caracteres"
                className={inputClassName}
                aria-describedby={error ? "recovery-error" : undefined}
              />
              <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((prev) => !prev)} />
            </div>
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="confirm-new-password" className={styles.fieldLabel}>Confirmar contraseña</label>
            <div className="relative">
              <input
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repite tu nueva contraseña"
                className={inputClassName}
                aria-describedby={error ? "recovery-error" : undefined}
              />
              <PasswordToggle visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((prev) => !prev)} />
            </div>
          </div>
          {error && <AuthNotice tone="error" id="recovery-error">{error}</AuthNotice>}
          {success && <AuthNotice tone="success">{success}</AuthNotice>}
          <AuthSubmitButton loading={loading} loadingLabel="Actualizando contraseña…">Guardar contraseña</AuthSubmitButton>
        </form>
      )}

      {step === "done" && (
        <div className={styles.form}>
          <AuthNotice tone="success">{success ?? "Contraseña actualizada correctamente."}</AuthNotice>
          <Link href={routes.login} className="auth-cta">Iniciar sesión</Link>
        </div>
      )}

      {step !== "done" && (
        <div className={styles.formFooter}>
          <Link href={routes.login} className={styles.textLink}>Volver al inicio de sesión</Link>
        </div>
      )}
    </div>
  );
}
