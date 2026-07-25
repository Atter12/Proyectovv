"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { formatMoney } from "@/lib/format";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";

type ClientRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  contactName: string | null;
  contactEmail: string | null;
  walletBalanceCents: number;
  walletCurrency: string;
  adAccountCount: number;
  activeMemberCount: number;
};

type ApiPayload = {
  ok: boolean;
  error?: string;
  source?: string;
  count?: number;
  clients?: ClientRow[];
  steps?: Array<{ step: string; ok: boolean; detail?: string }>;
  hint?: string;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ClientesPageClient() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ApiPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      console.log("[Clientes] click/load → GET /api/clientes …");
      try {
        const res = await fetch("/api/clientes", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const json = (await res.json()) as ApiPayload;
        console.log("[Clientes] status HTTP:", res.status);
        console.log("[Clientes] payload:", json);
        if (json.steps) {
          console.table(json.steps);
        }
        if (!json.ok) {
          console.error("[Clientes] ERROR:", json.error, json.hint ?? "");
        }
        if (!cancelled) setPayload(json);
      } catch (err) {
        console.error("[Clientes] fetch falló:", err);
        if (!cancelled) {
          setPayload({
            ok: false,
            error: err instanceof Error ? err.message : "Fetch falló",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const clients = payload?.clients ?? [];
    const query = q.trim().toLowerCase();
    return clients.filter((client) => {
      if (status !== "all" && client.status !== status) return false;
      if (!query) return true;
      const haystack = [
        client.name,
        client.slug,
        client.contactName,
        client.contactEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [payload?.clients, q, status]);

  return (
    <div className={dashboardClasses.page}>
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          Operación
        </p>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Elegir cliente
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--admin-text-muted,#64748b)]">
          Seleccioná un cliente y mirá solo lo suyo. Abrí la consola del navegador (F12 →
          Console) y buscá logs con prefijo <code>[Clientes]</code>.
        </p>
      </div>

      {loading ? (
        <Card className="p-5 text-sm text-[var(--admin-text-muted,#64748b)]">
          Cargando clientes…
        </Card>
      ) : null}

      {!loading && payload && !payload.ok ? (
        <Card className="border-rose-200 bg-rose-50 p-5 text-sm text-rose-950">
          <p className="font-semibold">Error al cargar Clientes</p>
          <p className="mt-1">{payload.error}</p>
          {payload.hint ? <p className="mt-2 text-xs opacity-80">{payload.hint}</p> : null}
          {payload.steps ? (
            <pre className="mt-3 overflow-x-auto rounded-lg bg-white/70 p-3 text-[11px] text-rose-900">
              {JSON.stringify(payload.steps, null, 2)}
            </pre>
          ) : null}
        </Card>
      ) : null}

      {!loading && payload?.ok ? (
        <Card className="border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
          OK · fuente: {payload.source} · {payload.count} cliente(s). Detalle en consola
          F12.
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_13rem_auto]">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente… (ej. Ely Aguirre)"
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="suspended">Suspendidos</option>
            <option value="archived">Archivados</option>
          </Select>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              console.log("[Clientes] filtro local", { q, status, filtered: filtered.length });
            }}
          >
            Filtrar
          </Button>
        </div>
      </Card>

      {!loading && payload?.ok && filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--admin-text-muted,#64748b)]">
          No hay clientes para mostrar.
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((client) => {
          const contactName =
            client.contactName?.trim() || client.contactEmail || client.name;
          const displayInitials = initials(contactName) || "CL";

          return (
            <Card key={client.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--brand-primary)]/10 text-sm font-bold text-[var(--brand-primary)]">
                  {displayInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-[var(--foreground)]">
                    {contactName}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-[var(--admin-text-muted,#64748b)]">
                    {client.name}
                    {client.contactEmail ? ` · ${client.contactEmail}` : ""}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2">
                  <dt className="text-[11px] text-[var(--admin-text-muted,#64748b)]">Wallet</dt>
                  <dd className="font-semibold">
                    {formatMoney(client.walletBalanceCents, client.walletCurrency)}
                  </dd>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2">
                  <dt className="text-[11px] text-[var(--admin-text-muted,#64748b)]">
                    Cuentas ads
                  </dt>
                  <dd className="font-semibold">{client.adAccountCount}</dd>
                </div>
              </dl>

              <div className="mt-3">
                <Badge variant="info">
                  {client.activeMemberCount} miembro
                  {client.activeMemberCount === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="mt-5">
                <Link
                  href={`/clientes/${client.id}`}
                  onClick={() =>
                    console.log("[Clientes] elegir cliente", client.id, contactName)
                  }
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-4 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-deep)]"
                >
                  Elegir este cliente
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
