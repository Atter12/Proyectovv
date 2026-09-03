"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { routes } from "@/config/routes";

export function ActingAsClienteBanner({
  clienteName,
}: {
  clienteName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function exitToStaff() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/clientes/seleccionar", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actAsCliente: false }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setError(json.error ?? "No se pudo salir de la vista cliente.");
          return;
        }
        router.push(routes.payments);
        router.refresh();
      } catch {
        setError("No se pudo salir de la vista cliente.");
      }
    });
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-950 sm:mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 font-medium leading-5">
          Estás viendo el panel{" "}
          <span className="font-bold">como {clienteName}</span>
          : gastos, cuentas y recargas de esa persona.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={routes.clientes}
            className="font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            Cambiar cliente
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={exitToStaff}
            className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[12px] font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-55"
          >
            {pending ? "Saliendo…" : "Salir a gerente"}
          </button>
        </div>
      </div>
      {error ? <p className="mt-1 text-[12px] text-rose-700">{error}</p> : null}
    </div>
  );
}
