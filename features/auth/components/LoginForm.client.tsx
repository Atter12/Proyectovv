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

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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

  return (
    <div className="auth-panel auth-enter relative w-full max-w-[420px] overflow-hidden rounded-2xl p-7 sm:p-8 lg:max-w-none">
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--auth-accent)]/55 to-transparent"
        aria-hidden
      />

      <div className="mb-7">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
          Acceso
        </p>
        <h1 className="font-display mt-2.5 text-[1.85rem] leading-none tracking-tight text-[var(--auth-text)] sm:text-[2rem]">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-[var(--auth-text-muted)]">
          Entrá a tu panel de anunciante
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-[14px] font-medium text-[var(--auth-text-muted)]"
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
            placeholder="tu@empresa.com"
            className={inputClassName}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label
              htmlFor="password"
              className="block text-[14px] font-medium text-[var(--auth-text-muted)]"
            >
              Contraseña
            </label>
            <Link
              href={routes.forgotPassword}
              className="text-[13px] font-medium text-[var(--auth-text-soft)] transition-colors hover:text-[var(--auth-accent)]"
            >
              ¿Olvidaste tu contraseña?
            </Link>
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

        {error && (
          <p
            className="rounded-xl border border-[var(--auth-danger)]/20 bg-[var(--auth-danger)]/[0.08] px-3.5 py-2.5 text-[14px] leading-5 text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1.5 flex h-12 w-full items-center justify-center rounded-xl bg-[var(--auth-accent)] text-[15px] font-semibold text-white transition-[background-color,box-shadow,transform] hover:bg-[var(--auth-accent-hover)] hover:shadow-[0_10px_28px_rgb(23_139_255_/_0.32)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
        >
          {loading ? "Iniciando sesión…" : "Iniciar sesión"}
        </button>
      </form>

      <div className="mt-6 border-t border-white/[0.07] pt-5 text-center text-[15px] text-[var(--auth-text-muted)]">
        ¿No tienes cuenta?{" "}
        <Link
          href={routes.register}
          className="font-semibold text-[var(--auth-accent)] transition-colors hover:text-[#7cc3ff]"
        >
          Regístrate
        </Link>
      </div>
    </div>
  );
}
