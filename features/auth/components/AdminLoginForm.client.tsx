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
      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-soft)] transition-colors hover:text-[var(--admin-text)]"
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
  "h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[rgba(18,52,72,0.45)] px-4 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-soft)] transition-colors focus:border-[var(--admin-accent)]/55 focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/20";

async function assertAdminAccess(): Promise<boolean> {
  const response = await fetch(routes.api.auth.adminAccess, { cache: "no-store" });
  return response.ok;
}

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminDestination = resolveSafeNextPath(
    searchParams.get("next"),
    routes.adminOverview,
    { requiredPrefix: "/admin" },
  );

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
      const verifyUrl = new URL(routes.verifyOtp, window.location.origin);
      verifyUrl.searchParams.set("email", email.trim());
      verifyUrl.searchParams.set("context", "admin");
      verifyUrl.searchParams.set("next", adminDestination);
      router.push(`${verifyUrl.pathname}${verifyUrl.search}`);
      router.refresh();
      return;
    }

    const allowed = await assertAdminAccess();
    if (!allowed) {
      router.push(routes.adminUnauthorized);
      router.refresh();
      return;
    }

    router.push(adminDestination);
    router.refresh();
  }

  return (
    <div className="w-full max-w-[420px] rounded-[1.35rem] border border-[var(--admin-border)] bg-[rgba(9,31,45,0.88)] p-7 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
      <div className="mb-7">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--admin-accent)] text-sm font-black text-[#082131]">VV</span>
          <div>
            <p className="text-sm font-bold text-[var(--admin-text)]">{siteConfig.name}</p>
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-[var(--admin-info)]">Admin console</p>
          </div>
        </div>
        <h1 className="text-2xl font-black tracking-[-0.03em] text-[var(--admin-text)]">Acceso operativo</h1>
        <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
          Inicia sesión con un usuario habilitado para operar la plataforma.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="admin-email" className="mb-1.5 block text-xs font-semibold text-[var(--admin-text-soft)]">
            Correo electrónico
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@empresa.com"
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="admin-password" className="mb-1.5 block text-xs font-semibold text-[var(--admin-text-soft)]">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingresa tu contraseña"
              className={cn(inputClassName, "pr-11")}
            />
            <PasswordToggle
              visible={showPassword}
              onToggle={() => setShowPassword((prev) => !prev)}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--admin-accent)] text-sm font-black text-[#082131] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Verificando acceso…" : "Entrar al panel admin"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-[var(--admin-text-soft)]">
        ¿Eres cliente?{" "}
        <Link href={routes.login} className="font-semibold text-[var(--admin-accent)] hover:underline">
          Ir al login de clientes
        </Link>
      </p>
    </div>
  );
}
