"use client";

import Link from "next/link";
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

const inputClassName =
  "h-[3.15rem] w-full rounded-[0.9rem] border border-[#e8e2da] bg-white pl-11 pr-4 text-[15px] text-[var(--auth-text)] placeholder:text-[#b0a89e] transition-[border-color,box-shadow] hover:border-[#d6cec4] focus:border-[var(--auth-accent)] focus:outline-none focus:ring-[3px] focus:ring-[var(--auth-accent)]/15";

interface LoginFormProps {
  hecomOtpEnabled?: boolean;
}

/**
 * Login Holistic — mockup split-card (OTP email).
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

  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupName, setLookupName] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupHint, setLookupHint] = useState<string | null>(null);
  const [lookupMatches, setLookupMatches] = useState<
    Array<{ name: string; email: string; emailMasked: string }>
  >([]);

  async function handleLookup() {
    setLookupLoading(true);
    setLookupError(null);
    setLookupHint(null);
    setLookupMatches([]);

    try {
      const response = await fetch(routes.api.auth.otpLookupEmail, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: lookupName.trim() }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        matches?: Array<{ name: string; email: string; emailMasked: string }>;
      };

      if (!response.ok) {
        setLookupError(payload.error ?? "No se pudo buscar el correo.");
        setLookupLoading(false);
        return;
      }

      setLookupMatches(payload.matches ?? []);
      setLookupHint(payload.message ?? null);
      setLookupLoading(false);
    } catch {
      setLookupError("No se pudo buscar. Reintentá.");
      setLookupLoading(false);
    }
  }

  function applyLookupEmail(nextEmail: string) {
    setEmail(nextEmail);
    setLookupOpen(false);
    setLookupError(null);
    setLookupHint(null);
    setLookupMatches([]);
    setError(null);
  }

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
      <div className="mb-7 sm:mb-8">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[var(--auth-accent)]">
          Hola de nuevo
        </p>
        <h1 className="mt-2 text-[1.65rem] font-bold leading-[1.12] tracking-[-0.03em] text-[#1a1a1a] sm:text-[1.95rem]">
          Iniciar sesión
        </h1>
        <p className="mt-2.5 max-w-[22rem] text-[13.5px] font-medium leading-6 text-[#7a736a] sm:text-[14px]">
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
            className="mb-2 block text-[13px] font-semibold text-[#1a1a1a]"
          >
            Correo electrónico
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b0a89e]"
              aria-hidden
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </span>
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
          {otpMode ? (
            <button
              type="button"
              onClick={() => {
                setLookupOpen((open) => !open);
                setLookupError(null);
                setLookupHint(null);
              }}
              className="mt-2.5 text-left text-[13px] font-semibold text-[var(--auth-accent)] underline-offset-2 hover:underline"
            >
              ¿No sabes cuál es tu correo?
            </button>
          ) : null}
        </div>

        {otpMode && lookupOpen ? (
          <div className="rounded-[1.1rem] border border-[#efe8e0] bg-[#fffaf6] px-4 py-4">
            <p className="text-[13px] font-semibold text-[#1a1a1a]">
              Buscá tu correo por nombre
            </p>
            <p className="mt-1 text-[12.5px] leading-5 text-[#7a736a]">
              Escribí tu nombre y apellido como figura en Hecom. Te mostramos el
              correo asociado para entrar.
            </p>
            <div className="mt-3 space-y-3">
              <div className="relative">
                <span
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b0a89e]"
                  aria-hidden
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </span>
                <input
                  id="lookup-name"
                  autoComplete="name"
                  minLength={4}
                  value={lookupName}
                  onChange={(event) => setLookupName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (lookupName.trim().length >= 4 && !lookupLoading) {
                        void handleLookup();
                      }
                    }
                  }}
                  placeholder="Ej. Ximena Jaño"
                  className={inputClassName}
                />
              </div>
              {lookupError ? (
                <p className="text-[13px] font-medium text-red-700" role="alert">
                  {lookupError}
                </p>
              ) : null}
              {lookupHint && lookupMatches.length === 0 ? (
                <p className="text-[13px] font-medium text-[#7a736a]">
                  {lookupHint}
                </p>
              ) : null}
              {lookupMatches.length > 0 ? (
                <ul className="space-y-2">
                  {lookupMatches.map((match) => (
                    <li key={`${match.email}-${match.name}`}>
                      <button
                        type="button"
                        onClick={() => applyLookupEmail(match.email)}
                        className="flex w-full items-center justify-between gap-3 rounded-[0.85rem] border border-[#e8e2da] bg-white px-3.5 py-3 text-left transition-[border-color,background-color] hover:border-[var(--auth-accent)]/50 hover:bg-[var(--auth-accent-soft)]/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-[#1a1a1a]">
                            {match.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-[#7a736a]">
                            {match.emailMasked}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] font-bold text-[var(--auth-accent)]">
                          Usar
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                onClick={() => void handleLookup()}
                disabled={lookupLoading || lookupName.trim().length < 4}
                className="flex h-11 w-full items-center justify-center rounded-[0.85rem] border border-[#e8e2da] bg-white text-[14px] font-bold text-[#1a1a1a] transition-[background-color] hover:bg-[#fff7f0] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {lookupLoading ? "Buscando…" : "Buscar mi correo"}
              </button>
            </div>
          </div>
        ) : null}

        {!otpMode && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label
                htmlFor="password"
                className="block text-[13px] font-semibold text-[#1a1a1a]"
              >
                Contraseña
              </label>
              <a
                href={routes.forgotPassword}
                className="text-[13px] font-medium text-[#7a736a] underline-offset-2 hover:text-[var(--auth-accent)] hover:underline"
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
                className={cn(inputClassName, "pl-4 pr-11")}
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
            className="rounded-[0.9rem] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[14px] font-medium leading-5 text-red-700"
            role="alert"
          >
            {error ??
              "El enlace mágico expiró o es inválido. Pedí uno nuevo."}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 flex h-[3.15rem] w-full items-center justify-center gap-2 rounded-[0.9rem] bg-[var(--auth-accent)] text-[15px] font-bold text-white shadow-[0_12px_28px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.04] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
        >
          {loading
            ? otpMode
              ? "Enviando…"
              : "Iniciando sesión…"
            : (
              <>
                Entrar
                <span aria-hidden className="text-[1.1rem] leading-none">
                  →
                </span>
              </>
            )}
        </button>
      </form>

      {otpMode ? (
        <div className="mt-7">
          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-[#ece7e0]" />
            <span className="text-[12.5px] font-medium text-[#9a9288]">
              ¿No tienes cuenta?
            </span>
            <span className="h-px flex-1 bg-[#ece7e0]" />
          </div>
          <Link
            href={routes.register}
            className="mt-4 flex h-[3.15rem] w-full items-center justify-center rounded-[0.9rem] border-[1.5px] border-[var(--auth-accent)] bg-white text-[15px] font-bold text-[var(--auth-accent)] transition-[background-color,transform] hover:bg-[var(--auth-accent-soft)] active:translate-y-px"
          >
            Registrarme
          </Link>
        </div>
      ) : (
        <p className="mt-6 text-center text-[13px] text-[#7a736a]">
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
