"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[app-error]", error.digest ?? "unknown");
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f7fb] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-[#0f172a]">
          Algo salió mal
        </h1>
        <p className="mt-2 text-sm text-[#64748b]">
          No pudimos completar la operación. Intenta de nuevo o vuelve más tarde.
        </p>
        <Button onClick={reset} className="mt-6">
          Reintentar
        </Button>
      </div>
    </div>
  );
}
