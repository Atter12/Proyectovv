"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { mapAuthErrorMessage } from "@/lib/auth/error-messages.client";

interface RegisterFormValues {
  fullName: string;
  organizationName: string;
  email: string;
  password: string;
  confirmPassword: string;
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

function readStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem("vv_referral_code");
  return value && value.trim() ? value.trim() : null;
}

function persistReferralCode(code: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("vv_referral_code", code);
  document.cookie = `vv_referral_code=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

async function trackReferralClick(code: string): Promise<void> {
  try {
    await fetch("/api/affiliates/track-referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, event: "click" }),
    });
  } catch {
    // El tracking no debe bloquear el registro.
  }
}

function validateForm(values: RegisterFormValues): string | null {
  if (!values.fullName.trim()) return "El nombre completo es obligatorio.";
  if (!values.organizationName.trim()) {
    return "El nombre de la organización es obligatorio.";
  }
  if (!values.email.trim()) return "El correo electrónico es obligatorio.";
  if (values.password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (values.password !== values.confirmPassword) {
    return "Las contraseñas no coinciden.";
  }
  return null;
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref")?.trim() || null;
  const [values, setValues] = useState<RegisterFormValues>({
    fullName: "",
    organizationName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!referralCode) return;

    persistReferralCode(referralCode);
    void trackReferralClick(referralCode);
  }, [referralCode]);

  function updateField<K extends keyof RegisterFormValues>(
    key: K,
    value: RegisterFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateForm(values);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const email = values.email.trim();
      const storedReferralCode = readStoredReferralCode() ?? referralCode;

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName.trim(),
            organization_name: values.organizationName.trim(),
            ...(storedReferralCode ? { referral_code: storedReferralCode } : {}),
          },
        },
      });

      if (signUpError) {
        setError(mapAuthErrorMessage(signUpError.message));
        return;
      }

      router.push(`${routes.verifyOtp}?email=${encodeURIComponent(email)}`);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? mapAuthErrorMessage(err.message)
          : "No se pudo conectar con Supabase. Revisa la configuración del servidor.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-panel auth-enter relative w-full max-w-[440px] overflow-hidden rounded-2xl p-7 sm:p-8 lg:max-w-none">
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--auth-accent)]/55 to-transparent"
        aria-hidden
      />

      <div className="mb-7">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
          Registro
        </p>
        <h1 className="font-display mt-2.5 text-[1.85rem] leading-none tracking-tight text-[var(--auth-text)] sm:text-[2rem]">
          Crear cuenta
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-[var(--auth-text-muted)]">
          Regístrate como anunciante en {siteConfig.name}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="fullName"
              className="mb-2 block text-[14px] font-medium text-[var(--auth-text-muted)]"
            >
              Nombre completo
            </label>
            <input
              id="fullName"
              required
              value={values.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
              placeholder="María González"
              className={inputClassName}
            />
          </div>
          <div>
            <label
              htmlFor="organizationName"
              className="mb-2 block text-[14px] font-medium text-[var(--auth-text-muted)]"
            >
              Organización
            </label>
            <input
              id="organizationName"
              required
              value={values.organizationName}
              onChange={(event) =>
                updateField("organizationName", event.target.value)
              }
              placeholder="Mi agencia"
              className={inputClassName}
            />
          </div>
        </div>

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
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="tu@empresa.com"
            className={inputClassName}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-[14px] font-medium text-[var(--auth-text-muted)]"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={values.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="Mín. 8 caracteres"
                className={cn(inputClassName, "pr-11")}
              />
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-[14px] font-medium text-[var(--auth-text-muted)]"
            >
              Confirmar
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={values.confirmPassword}
                onChange={(event) =>
                  updateField("confirmPassword", event.target.value)
                }
                placeholder="Repite contraseña"
                className={cn(inputClassName, "pr-11")}
              />
              <PasswordToggle
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((prev) => !prev)}
              />
            </div>
          </div>
        </div>

        {referralCode && (
          <div className="rounded-xl border border-[var(--auth-accent)]/25 bg-[var(--auth-accent-soft)] px-3.5 py-2.5 text-[13px] font-medium text-[#b7d9ff]">
            Código referido aplicado:{" "}
            <span className="font-semibold text-[var(--auth-text)]">{referralCode}</span>
          </div>
        )}

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
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>

        <p className="text-center text-[13px] leading-5 text-[var(--auth-text-soft)]">
          Al registrarte aceptas nuestros términos de servicio y política de
          privacidad.
        </p>
      </form>

      <div className="mt-6 border-t border-white/[0.07] pt-5 text-center text-[15px] text-[var(--auth-text-muted)]">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={routes.login}
          className="font-semibold text-[var(--auth-accent)] transition-colors hover:text-[#7cc3ff]"
        >
          Inicia sesión
        </Link>
      </div>
    </div>
  );
}
