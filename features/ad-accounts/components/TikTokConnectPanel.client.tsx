"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { TikTokConnectionStatus } from "@/lib/integrations/tiktok/types";

interface TikTokConnectPanelProps {
  organizationName: string;
  initialStatus: TikTokConnectionStatus;
  canManage: boolean;
}

function formatDate(value: string | null): string {
  if (!value) return "Sin sync aún";
  try {
    return new Intl.DateTimeFormat("es", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function TikTokConnectPanel({
  organizationName,
  initialStatus,
  canManage,
}: TikTokConnectPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState<"import" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleImport() {
    setBusy("import");
    setError(null);
    setInfo(null);
    try {
      const result = await apiClient<{ ok: boolean; imported: number }>(
        "/api/integrations/tiktok/ad-accounts",
        { method: "POST" },
      );
      setInfo(
        result.imported > 0
          ? `Se sincronizaron ${result.imported} cuenta${result.imported === 1 ? "" : "s"} de TikTok.`
          : "No había advertisers nuevos para importar.",
      );
      const refreshed = await apiClient<TikTokConnectionStatus & { ok: boolean }>(
        "/api/integrations/tiktok/status",
      );
      setStatus(refreshed);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "No se pudo reimportar.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    if (
      !window.confirm(
        `¿Desconectar TikTok de “${organizationName}”? Solo afecta a esta organización; los demás clientes no cambian.`,
      )
    ) {
      return;
    }

    setBusy("disconnect");
    setError(null);
    setInfo(null);
    try {
      await apiClient("/api/integrations/tiktok/disconnect", { method: "POST" });
      setStatus((prev) => ({
        ...prev,
        connected: false,
        status: "revoked",
        lastError: null,
      }));
      setInfo("TikTok desconectado para esta organización.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "No se pudo desconectar.");
    } finally {
      setBusy(null);
    }
  }

  const connected = status.connected;

  return (
    <Card className="overflow-hidden border-[var(--border-subtle)]" padding="none">
      <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Integración por cliente
            </p>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                connected
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {connected ? "Conectado" : "Sin conectar"}
            </span>
          </div>

          <h2 className="font-display mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
            Conectar TikTok Ads
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--admin-text-muted,#64748b)]">
            Cada cliente tiene su propia organización. Esta conexión es solo para{" "}
            <span className="font-semibold text-[var(--foreground)]">{organizationName}</span>
            : sus advertisers, gasto y datos. Luis Vargas, Ely Aguirre u otros no ven ni
            comparten esta autorización.
          </p>

          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2.5">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
                Organización
              </dt>
              <dd className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
                {organizationName}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2.5">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
                Cuentas TikTok
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {status.importedTikTokAccounts}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2.5">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
                Último sync
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {formatDate(status.lastSyncedAt ?? status.updatedAt)}
              </dd>
            </div>
          </dl>

          {!status.configured && (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              TikTok OAuth aún no está configurado en el servidor (faltan keys). El flujo
              de UI ya está listo; ops debe cargar TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET.
            </p>
          )}

          {error && (
            <p className="mt-4 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="mt-4 text-xs text-emerald-700" role="status">
              {info}
            </p>
          )}
        </div>

        <div className="flex flex-col justify-center gap-3 border-t border-[var(--border-subtle)] bg-[linear-gradient(165deg,#f8fbff_0%,#eef6ff_55%,#f7fafc_100%)] p-5 sm:p-6 lg:border-l lg:border-t-0">
          {canManage ? (
            <>
              {status.configured ? (
                <a href="/api/integrations/tiktok/connect" className="block">
                  <Button className="h-11 w-full rounded-xl bg-[var(--brand-primary)] text-[14px] font-semibold hover:bg-[var(--brand-primary-deep)]">
                    {connected ? "Reconectar TikTok" : "Conectar con TikTok"}
                  </Button>
                </a>
              ) : (
                <Button
                  disabled
                  className="h-11 w-full rounded-xl bg-[var(--brand-primary)] text-[14px] font-semibold opacity-60"
                >
                  Conectar con TikTok
                </Button>
              )}

              {connected && (
                <>
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-xl"
                    disabled={busy !== null}
                    onClick={handleImport}
                  >
                    {busy === "import" ? "Sincronizando…" : "Reimportar cuentas"}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                    disabled={busy !== null}
                    onClick={handleDisconnect}
                  >
                    {busy === "disconnect" ? "Desconectando…" : "Desconectar"}
                  </Button>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--admin-text-muted,#64748b)]">
              Solo el dueño o un admin de esta organización puede conectar TikTok.
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-[var(--admin-text-muted,#64748b)]">
            Al autorizar, importamos tus advertisers a Holistic Marketing. El gasto se sincroniza por
            organización. Las campañas a nivel detalle llegan en una siguiente iteración;
            hoy ya ves cuentas y gasto ads.
          </p>
        </div>
      </div>
    </Card>
  );
}
