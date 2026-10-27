"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Cliente con más de una ficha vinculada (ej. un negocio en Perú y otro en México)
 * y sin ficha elegida: elige con cuál entrar. Antes quedaba en una pantalla sin salida.
 */
export function PickOwnCliente({
  clientes,
  errorLabel,
}: {
  clientes: Array<{ id: string; name: string }>;
  errorLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function pick(cliente: { id: string; name: string }) {
    setBusy(cliente.id);
    setError(false);
    try {
      const res = await fetch("/api/clientes/seleccionar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId: cliente.id, name: cliente.name }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setError(true);
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 flex w-full max-w-sm flex-col gap-2">
      {clientes.map((c) => (
        <button
          key={c.id}
          type="button"
          disabled={busy !== null}
          onClick={() => void pick(c)}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--auth-accent)] px-5 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05] disabled:opacity-60"
        >
          {busy === c.id ? "…" : c.name}
        </button>
      ))}
      {error ? (
        <p className="text-[13px] font-medium text-[var(--auth-danger,#b42318)]">{errorLabel}</p>
      ) : null}
    </div>
  );
}
