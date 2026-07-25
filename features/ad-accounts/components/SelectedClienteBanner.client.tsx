"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { routes } from "@/config/routes";
import { Button } from "@/components/ui/Button";

type Props = {
  clienteId: string;
  clienteName: string;
  accountCount: number;
};

export function SelectedClienteBanner({
  clienteId,
  clienteName,
  accountCount,
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
        <div>
          <p className="font-semibold">
            Filtrado por cliente: {clienteName}
          </p>
          <p className="mt-0.5 opacity-90">
            Solo ves las cuentas TikTok de esta persona ({accountCount}).
            {" "}
            <Link
              href={`/clientes/${clienteId}`}
              className="font-semibold underline-offset-2 hover:underline"
            >
              Ver ficha
            </Link>
          </p>
          {error ? <p className="mt-1 text-rose-700">{error}</p> : null}
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
