"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
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

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#4056ff] to-[#7c3aed] text-[10px] font-bold text-white">
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
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
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
  "h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-[#4056ff]/60 focus:outline-none focus:ring-2 focus:ring-[#4056ff]/25";

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

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName.trim(),
            organization_name: values.organizationName.trim(),
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
    <div className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-[#141c2edb] p-7 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Crear cuenta</h1>
          <p className="mt-1 text-sm text-slate-400">
            Regístrate como anunciante en {siteConfig.name}
          </p>
        </div>
        <BrandMark />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="fullName"
              className="mb-2 block text-xs font-medium text-slate-400"
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
              className="mb-2 block text-xs font-medium text-slate-400"
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
            className="mb-2 block text-xs font-medium text-slate-400"
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
              className="mb-2 block text-xs font-medium text-slate-400"
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
              className="mb-2 block text-xs font-medium text-slate-400"
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

        {error && (
          <p
            className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-[#4056ff] text-sm font-semibold text-white shadow-lg shadow-[#4056ff]/25 transition-all hover:bg-[#4d62ff] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>

        <p className="text-center text-[11px] leading-relaxed text-slate-500">
          Al registrarte aceptas nuestros términos de servicio y política de
          privacidad.
        </p>
      </form>

      <p className="mt-5 text-center text-sm text-slate-400">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={routes.login}
          className="font-medium text-[#6b8cff] transition-colors hover:text-[#8aa4ff] hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
