"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { mapAuthErrorMessage } from "@/lib/auth/error-messages.client";

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
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--auth-text-soft)] transition-colors hover:bg-[var(--auth-control-hover)] hover:text-[var(--auth-text)]"
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

/** Inputs estilo mortgage (pill suave). */
const inputClassName =
  "h-12 w-full rounded-full border border-[var(--auth-input-border)] bg-[var(--auth-bg)] px-5 text-[15px] text-[var(--auth-text)] placeholder:text-[var(--auth-text-soft)] transition-[border-color,box-shadow,background-color] hover:border-[var(--auth-input-border-hover)] focus:border-[var(--auth-accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/20";

interface LoginFormProps {
  hecomOtpEnabled?: boolean;
}

/**
 * Login Holistic — layout mortgage (form limpio).
 * Acceso simplificado: solo correo → código / enlace mágico (OTP).
 */
export function LoginForm({ hecomOtpEnabled = false }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const otpMode = hecomOtpEnabled;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOtpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(routes.api.auth.otpRequest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        email?: string;
        retryAfterSec?: number;
      };

      if (!response.ok) {
        setError(
          mapAuthErrorMessage(payload.error ?? "No se pudo enviar el acceso."),
        );
        setLoading(false);
        return;
      }

      const canonicalEmail =
        payload.email?.trim() ||
        email.trim().toLowerCase();

      const verifyUrl = new URL(routes.verifyOtp, window.location.origin);
      verifyUrl.searchParams.set("email", canonicalEmail);
      verifyUrl.searchParams.set("flow", "hecom");
      verifyUrl.searchParams.set("sent", "1");
      if (payload.retryAfterSec) {
        verifyUrl.searchParams.set(
          "cooldown",
          String(payload.retryAfterSec),
        );
      }
      if (payload.message) {
        verifyUrl.searchParams.set("hint", payload.message);
      }
      const nextPath = searchParams.get("next");
      if (nextPath) verifyUrl.searchParams.set("next", nextPath);

      router.push(`${verifyUrl.pathname}${verifyUrl.search}`);
      router.refresh();
    } catch {
      setError("No se pudo enviar el acceso. Reintentá.");
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(mapAuthErrorMessage(signInError.message));
      setLoading(false);
      return;
    }

    if (data.user && !data.user.email_confirmed_at) {
      router.push(
        `${routes.verifyOtp}?email=${encodeURIComponent(email.trim())}`,
      );
      router.refresh();
      return;
    }

    const nextPath = searchParams.get("next");
    const destination =
      nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
        ? nextPath
        : routes.overview;

    router.push(destination);
    router.refresh();
  }

  const magicError = searchParams.get("error") === "magic_link";

  return (
    <div className="w-full">
      <div className="mb-6 sm:mb-7">
        <h1 className="font-display text-[1.45rem] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.85rem]">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-[13.5px] font-medium leading-6 text-[var(--auth-text-muted)] sm:text-[14px]">
          {otpMode
            ? "Ingresá tu correo. Te enviamos un código y un enlace para entrar."
            : "Entrá a tu panel de anunciante"}
        </p>
      </div>

      <form
        onSubmit={otpMode ? handleOtpSubmit : handlePasswordSubmit}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-[13px] font-medium text-[var(--auth-text)]"
          >
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@gmail.com"
            className={inputClassName}
          />
        </div>

        {!otpMode && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label
                htmlFor="password"
                className="block text-[13px] font-medium text-[var(--auth-text)]"
              >
                Contraseña
              </label>
              <a
                href={routes.forgotPassword}
                className="text-[13px] font-medium text-[var(--auth-text-muted)] underline-offset-2 hover:text-[var(--auth-accent)] hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña"
                className={cn(inputClassName, "pr-11")}
              />
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
              />
            </div>
          </div>
        )}

        {(error || magicError) && (
          <p
            className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[14px] font-medium leading-5 text-red-700"
            role="alert"
          >
            {error ??
              "El enlace mágico expiró o es inválido. Pedí uno nuevo."}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-[var(--auth-accent)] text-[15px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.04] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
        >
          {loading
            ? otpMode
              ? "Enviando…"
              : "Iniciando sesión…"
            : "Entrar"}
        </button>
      </form>

      {otpMode ? (
        <p className="mt-6 text-center text-[13px] leading-6 text-[var(--auth-text-muted)]">
          Revisá tu correo: entrás con el{" "}
          <strong className="font-semibold text-[var(--auth-text)]">
            código de 6 dígitos
          </strong>{" "}
          o el{" "}
          <strong className="font-semibold text-[var(--auth-text)]">
            enlace mágico
          </strong>
          .
        </p>
      ) : (
        <p className="mt-6 text-center text-[13px] text-[var(--auth-text-muted)]">
          ¿Problemas?{" "}
          <a
            href={routes.forgotPassword}
            className="font-semibold text-[var(--auth-accent)] hover:underline"
          >
            Recuperar acceso
          </a>
        </p>
      )}
    </div>
  );
}
