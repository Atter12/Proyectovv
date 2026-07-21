"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function TikTokIntegrationBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const integration = searchParams.get("integration");
  const integrationStatus = searchParams.get("integration_status");
  const message = searchParams.get("message");

  const visible =
    !dismissed &&
    integration === "tiktok" &&
    (integrationStatus === "connected" || integrationStatus === "failed");

  const cleanUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("integration");
    params.delete("integration_status");
    params.delete("message");
    // Compatibilidad con redirects viejos.
    if (params.get("status") === "connected" || params.get("status") === "failed") {
      params.delete("status");
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      setDismissed(true);
      router.replace(cleanUrl, { scroll: false });
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [cleanUrl, router, visible]);

  if (!visible) return null;

  const ok = integrationStatus === "connected";

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-rose-200 bg-rose-50 text-rose-900"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">
            {ok ? "TikTok conectado correctamente" : "No se pudo completar la conexión con TikTok"}
          </p>
          <p className="mt-1 text-sm opacity-90">
            {ok
              ? "Se importaron las cuentas advertiser. El gasto y las métricas se llenan cuando asignes saldo y corra el sync."
              : message ?? "Revisa la autorización e inténtalo de nuevo."}
          </p>
        </div>
        <div className="flex gap-2">
          {!ok && (
            <a href="/api/integrations/tiktok/connect">
              <Button className="h-10 rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)]">
                Reintentar
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => {
              setDismissed(true);
              router.replace(cleanUrl, { scroll: false });
            }}
          >
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
