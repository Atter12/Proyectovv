"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { routes } from "@/config/routes";
import { Button } from "@/components/ui/Button";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";

type Props = {
  clienteId: string;
  clienteName: string;
  avatarUrl?: string | null;
  detail?: string;
};

export function SelectedClienteBanner({
  clienteId,
  clienteName,
  avatarUrl,
  detail,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function clearSelection() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/clientes/seleccionar", {
          method: "DELETE",
          credentials: "include",
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setError(json.error ?? "No se pudo limpiar la selección");
          return;
        }
        router.push(routes.clientes);
        router.refresh();
      } catch {
        setError("No se pudo limpiar la selección");
      }
    });
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <HecomClienteAvatar
            name={clienteName}
            avatarUrl={avatarUrl}
            size="md"
          />
          <div className="min-w-0">
            <p className="font-semibold">Cliente activo: {clienteName}</p>
            <p className="mt-0.5 opacity-90">
              {detail ??
                "Todo el panel (cuentas, pagos, creativos, etc.) está filtrado a esta persona."}{" "}
              <Link
                href={`/clientes/${clienteId}`}
                className="font-semibold underline-offset-2 hover:underline"
              >
                Ver ficha
              </Link>
            </p>
            {error ? <p className="mt-1 text-rose-700">{error}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild href={routes.clientes} variant="secondary" size="sm">
            Cambiar cliente
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={clearSelection}
          >
            {pending ? "…" : "Quitar filtro"}
          </Button>
        </div>
      </div>
    </div>
  );
}
