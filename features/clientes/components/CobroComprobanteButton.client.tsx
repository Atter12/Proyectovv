"use client";

import { useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";

export function CobroComprobanteButton({
  cobroId,
  index = 0,
  label = "Ver comprobante",
}: {
  cobroId: string;
  index?: number;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<{ url: string }>(
        `/api/hecom/cobros/${encodeURIComponent(cobroId)}/comprobante?index=${index}`,
      );
      if (!data.url) {
        throw new Error("Comprobante no disponible.");
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo abrir el comprobante.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void handleOpen()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--auth-control-border)] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--auth-accent)] transition hover:bg-[var(--auth-bg)] disabled:opacity-60"
        title={label}
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.036 12.322a1 1 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        {loading ? "Abriendo…" : label}
      </button>
      {error ? (
        <span className="text-[10px] font-medium text-red-600">{error}</span>
      ) : null}
    </div>
  );
}
