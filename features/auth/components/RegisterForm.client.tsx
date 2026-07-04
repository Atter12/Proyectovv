"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/client";

interface RegisterFormValues {
  fullName: string;
  organizationName: string;
  email: string;
  password: string;
  confirmPassword: string;
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
  const [values, setValues] = useState<RegisterFormValues>({
    fullName: "",
    organizationName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
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
        setError(signUpError.message);
        return;
      }

      router.push(`${routes.verifyOtp}?email=${encodeURIComponent(email)}`);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo conectar con Supabase. Revisa la configuración del servidor.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md" padding="lg">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white">
          DM
        </div>
        <h1 className="text-xl font-bold text-slate-900">{siteConfig.name}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Crea tu cuenta de anunciante
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-xs font-medium text-slate-600">
            Nombre completo
          </label>
          <Input
            id="fullName"
            required
            value={values.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
            placeholder="Sandro Wong Mera"
          />
        </div>

        <div>
          <label htmlFor="organizationName" className="mb-1.5 block text-xs font-medium text-slate-600">
            Nombre de la organización
          </label>
          <Input
            id="organizationName"
            required
            value={values.organizationName}
            onChange={(event) =>
              updateField("organizationName", event.target.value)
            }
            placeholder="Mi agencia publicitaria"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-600">
            Correo electrónico
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="tu@empresa.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-slate-600">
            Contraseña
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={values.password}
            onChange={(event) => updateField("password", event.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-medium text-slate-600">
            Confirmar contraseña
          </label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={values.confirmPassword}
            onChange={(event) =>
              updateField("confirmPassword", event.target.value)
            }
            placeholder="Repite tu contraseña"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{" "}
        <Link href={routes.login} className="font-medium text-indigo-600 hover:text-indigo-700">
          Inicia sesión
        </Link>
      </p>
    </Card>
  );
}
