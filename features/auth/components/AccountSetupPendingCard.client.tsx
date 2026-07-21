"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { EcomdyLogo } from "@/components/brand/EcomdyLogo";

interface AccountSetupPendingCardProps {
  error?: string;
}

export function AccountSetupPendingCard({ error }: AccountSetupPendingCardProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRetry() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }

  return (
    <Card className="w-full max-w-md" padding="lg">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <EcomdyLogo size={48} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          Configurando tu cuenta
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Tu correo ya está verificado. Estamos preparando tu organización y
          cartera en {siteConfig.name}.
        </p>
      </div>

      <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700" role="alert">
            {error}
          </p>
        )}
        <p>Si esta pantalla no avanza en unos segundos:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Pulsa <strong>Reintentar</strong> para comprobar de nuevo.</li>
          <li>
            Confirma que las variables de Vercel incluyen <strong>SUPABASE_SERVICE_ROLE_KEY</strong> y que la base tiene las tablas de Supabase ya creadas.
          </li>
        </ul>
      </div>

      <Button
        type="button"
        size="lg"
        className="mt-6 w-full"
        disabled={refreshing}
        onClick={handleRetry}
      >
        {refreshing ? "Comprobando…" : "Reintentar"}
      </Button>

      <p className="mt-4 text-center text-sm text-slate-500">
        <Link href={routes.login} className="font-medium text-indigo-600 hover:text-indigo-700">
          Volver al inicio de sesión
        </Link>
      </p>
    </Card>
  );
}
