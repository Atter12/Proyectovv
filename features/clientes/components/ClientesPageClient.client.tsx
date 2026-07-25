"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { routes } from "@/config/routes";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";

type TiktokAccount = {
  advertiserId: string;
  advertiserName: string | null;
  bmBucket: string | null;
  fee: number | null;
  syncEnabled: boolean;
};

type ClientRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  contactName: string | null;
  contactEmail: string | null;
  biz?: string | null;
  phones?: string[];
  avatarUrl?: string | null;
  walletBalanceCents: number;
  walletCurrency: string;
  adAccountCount: number;
  activeMemberCount: number;
  tiktokAdvertiserId?: string | null;
  tiktokAccounts?: TiktokAccount[];
};

type ApiPayload = {
  ok: boolean;
  error?: string;
  source?: string;
  count?: number;
  clients?: ClientRow[];
  steps?: Array<{ step: string; ok: boolean; detail?: string }>;
  hint?: string;
  note?: string;
};

export function ClientesPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      console.log("[Clientes] click/load → GET /api/clientes (Hecom Club) …");
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
    if (!query) return clients;
    return clients.filter((client) => {
      const haystack = [
        client.name,
        client.slug,
        client.contactName,
        client.contactEmail,
        client.biz,
        ...(client.phones ?? []),
        client.tiktokAdvertiserId,
        ...(client.tiktokAccounts ?? []).flatMap((a) => [
          a.advertiserId,
          a.advertiserName,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [payload?.clients, q]);

  function elegirCliente(client: ClientRow) {
    const contactName =
      client.contactName?.trim() || client.contactEmail || client.name;
    setSelectError(null);
    setSelectingId(client.id);
    startTransition(async () => {
      try {
        console.log("[Clientes] seleccionar", client.id, contactName);
        const res = await fetch("/api/clientes/seleccionar", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clienteId: client.id,
            name: contactName,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setSelectError(json.error ?? "No se pudo seleccionar el cliente");
          setSelectingId(null);
          return;
        }
        router.push(routes.overview);
        router.refresh();
      } catch (err) {
        setSelectError(
          err instanceof Error ? err.message : "No se pudo seleccionar",
        );
        setSelectingId(null);
      }
    });
  }

  return (
    <div className={dashboardClasses.page}>
      <div className="dashboard-surface-card rounded-[1.5rem] p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary-deep)]">
          Hecom Club · CRM
        </p>
        <h1 className="font-display mt-1 text-2xl font-medium tracking-tight text-[#141210] sm:text-[1.85rem]">
          Elegir cliente
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6b645c]">
          Elegí un cliente Hecom. Después, en{" "}
          <strong className="font-semibold text-[#141210]">Mis cuentas publicitarias</strong>{" "}
          solo vas a ver lo de esa persona.
        </p>
      </div>

      {selectError ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
          {selectError}
        </Card>
      ) : null}

      {loading ? (
        <Card className="p-5 text-sm text-[var(--admin-text-muted,#64748b)]">
          Cargando clientes de Hecom Club…
        </Card>
      ) : null}

      {!loading && payload && !payload.ok ? (
        <Card className="border-rose-200 bg-rose-50 p-5 text-sm text-rose-950">
          <p className="font-semibold">Error al cargar Clientes Hecom</p>
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
          OK · fuente: {payload.source} · {payload.count} cliente(s) Hecom Club.
          {payload.note ? ` ${payload.note}` : ""}
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar… (nombre, mail, DNI, advertiser)"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              console.log("[Clientes] filtro local", { q, filtered: filtered.length });
            }}
          >
            Filtrar
          </Button>
        </div>
      </Card>

      {!loading && payload?.ok && filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--admin-text-muted,#64748b)]">
          No hay clientes Hecom para mostrar.
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((client) => {
          const contactName =
            client.contactName?.trim() || client.contactEmail || client.name;
          const busy = pending && selectingId === client.id;

          return (
            <Card
              key={client.id}
              className="dashboard-surface-card flex flex-col p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgb(255_120_31_/_0.14)]"
            >
              <div className="flex items-start gap-3">
                <HecomClienteAvatar
                  name={contactName}
                  avatarUrl={client.avatarUrl}
                  size="md"
                  className="ring-2 ring-[var(--brand-primary)]/15"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-[1.05rem] font-medium text-[#141210]">
                    {contactName}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-[#6b645c]">
                    {client.biz ? `${client.biz} · ` : ""}
                    {client.contactEmail ?? client.slug}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-[#f4f7fc] px-3 py-2">
                  <dt className="text-[11px] text-[#6b645c]">Cuentas TikTok</dt>
                  <dd className="font-semibold text-[#141210]">
                    {client.adAccountCount}
                  </dd>
                </div>
                <div className="rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-[#f4f7fc] px-3 py-2">
                  <dt className="text-[11px] text-[#6b645c]">Emails</dt>
                  <dd className="font-semibold text-[#141210]">
                    {client.activeMemberCount}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="info">Hecom CRM</Badge>
                {client.tiktokAdvertiserId ||
                (client.tiktokAccounts?.length ?? 0) > 0 ? (
                  <Badge variant="neutral">TikTok linked</Badge>
                ) : null}
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy || pending}
                  onClick={() => elegirCliente(client)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-4 text-[14px] font-semibold text-white shadow-[0_10px_28px_rgb(255_120_31_/_0.32)] transition-[background-color,transform] hover:bg-[var(--brand-primary-deep)] hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {busy ? "Eligiendo…" : "Elegir este cliente"}
                </button>
                <Link
                  href={`/clientes/${client.id}`}
                  className="text-center text-xs font-medium text-[var(--brand-primary-deep)] hover:underline"
                >
                  Ver ficha
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
