"use client";

import { useEffect } from "react";

/** Persists Hecom client selection when opening the ficha (cookie for /ad-accounts scope). */
export function SelectHecomClienteOnMount({
  clienteId,
  name,
}: {
  clienteId: string;
  name: string;
}) {
  useEffect(() => {
    void fetch("/api/clientes/seleccionar", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId, name }),
    }).then((res) => {
      if (!res.ok) {
        console.warn("[Clientes] no se pudo persistir selección", res.status);
      }
    });
  }, [clienteId, name]);

  return null;
}
