"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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
  scopedToEmail?: boolean;
};

export function ClientesPageClient({
  mode = "staff",
}: {
  /** staff = lista CRM completa para fondear. */
  mode?: "staff" | "scoped";
}) {
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
      try {
        const res = await fetch("/api/clientes", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const json = (await res.json()) as ApiPayload;
        if (!cancelled) setPayload(json);
      } catch (err) {
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

  useEffect(() => {
    // Solo auto-elegir si el usuario es cliente scoped (1 cuenta propia).
    if (mode === "staff") return;
    if (!payload?.ok || !payload.scopedToEmail || selectingId) return;
    const only = payload.clients;
    if (!only || only.length !== 1) return;
    elegirCliente(only[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-scope 1 cliente
  }, [payload?.ok, payload?.scopedToEmail, payload?.clients?.length, selectingId, mode]);

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

  function elegirCliente(client: ClientRow, actAsCliente = false) {
    const contactName =
      client.contactName?.trim() || client.contactEmail || client.name;
    setSelectError(null);
    setSelectingId(client.id);
    startTransition(async () => {
      try {
        const res = await fetch("/api/clientes/seleccionar", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clienteId: client.id,
            name: contactName,
            actAsCliente,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setSelectError(json.error ?? "No se pudo seleccionar el cliente");
          setSelectingId(null);
          return;
        }
        // Gerente va directo a Pagos (fondear BM); scoped sigue a overview.
        router.push(actAsCliente ? routes.overview : mode === "staff" ? routes.payments : routes.overview);
        router.refresh();
      } catch (err) {
        setSelectError(
          err instanceof Error ? err.message : "No se pudo seleccionar",
        );
        setSelectingId(null);
      }
    });
  }

  const total = payload?.clients?.length ?? 0;
  const shown = filtered.length;
  const isStaffPicker = mode === "staff" || !payload?.scopedToEmail;

  return (
    <div className={dashboardClasses.page}>
      <header className="border-b border-[var(--auth-divider)] pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
          {isStaffPicker ? "CRM Hecom" : "Tu cuenta"}
        </p>
        <h1 className="mt-1 text-[1.125rem] font-bold leading-snug tracking-[-0.02em] text-[var(--auth-text)] sm:text-[1.25rem]">
          {isStaffPicker ? "Elegí un cliente" : "Elegir cliente"}
        </h1>
        <p className="mt-1 text-[13px] text-[var(--auth-text-muted)]">
          {isStaffPicker
            ? "Recargar como gerente (BM) o entrar al panel como esa persona: gastos, cuentas y recarga Stripe."
            : "Solo ves los clientes de tu cuenta."}
        </p>
        {!loading && payload?.ok ? (
          <p className="mt-2 text-[12px] font-medium tabular-nums text-[var(--auth-text-soft)]">
            {shown === total
              ? `${total} cliente${total === 1 ? "" : "s"}`
              : `${shown} de ${total} clientes`}
          </p>
        ) : null}
      </header>

      {selectError ? (
        <div
          className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-800"
          role="alert"
        >
          {selectError}
        </div>
      ) : null}

      {!loading && payload && !payload.ok ? (
        <div
          className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-4 text-[14px] text-red-900"
          role="alert"
        >
          <p className="font-semibold">No se pudieron cargar los clientes</p>
          <p className="mt-1 font-medium text-red-800/90">
            {payload.error ?? "Error desconocido. Reintentá en unos segundos."}
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-[var(--auth-border)] bg-white p-4 sm:p-5">
        <label className="sr-only" htmlFor="clientes-search">
          Buscar cliente
        </label>
        <input
          id="clientes-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, mail o advertiser…"
          className="h-11 w-full rounded-lg border border-[var(--auth-input-border)] bg-white px-3.5 text-[14px] text-[var(--auth-text)] placeholder:text-[var(--auth-text-soft)] transition-[border-color,box-shadow] hover:border-[var(--auth-input-border-hover)] focus:border-[var(--auth-accent)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/20"
        />
      </div>

      {loading ? (
        <div className="dashboard-surface-card rounded-[1rem] p-8 text-center text-[14px] font-medium text-[var(--auth-text-muted)]">
          Cargando clientes…
        </div>
      ) : null}

      {!loading && payload?.ok && filtered.length === 0 ? (
        <div className="dashboard-surface-card rounded-[1rem] p-10 text-center text-[14px] font-medium text-[var(--auth-text-muted)]">
          {q.trim()
            ? "Ningún cliente coincide con la búsqueda."
            : "No hay clientes Hecom para mostrar."}
        </div>
      ) : null}

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((client) => {
          const contactName =
            client.contactName?.trim() || client.contactEmail || client.name;
          const busy = pending && selectingId === client.id;
          const hasTikTok =
            Boolean(client.tiktokAdvertiserId) ||
            (client.tiktokAccounts?.length ?? 0) > 0;

          return (
            <article
              key={client.id}
              className="flex flex-col rounded-lg border border-[var(--auth-border)] bg-white p-4 transition-colors hover:border-[var(--auth-text-soft)] sm:p-5"
            >
              <div className="flex items-start gap-3">
                <HecomClienteAvatar
                  name={contactName}
                  avatarUrl={client.avatarUrl}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[1rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                    {contactName}
                  </h2>
                  <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--auth-text-muted)]">
                    {client.biz ? `${client.biz} · ` : ""}
                    {client.contactEmail ?? client.slug}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[var(--auth-divider)] bg-[var(--auth-bg)] px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                    TikTok
                  </dt>
                  <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-[var(--auth-text)]">
                    {client.adAccountCount}
                  </dd>
                </div>
                <div className="rounded-lg border border-[var(--auth-divider)] bg-[var(--auth-bg)] px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                    Contactos
                  </dt>
                  <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-[var(--auth-text)]">
                    {client.activeMemberCount}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-[var(--auth-border)] bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--auth-text-muted)]">
                  Hecom
                </span>
                {hasTikTok ? (
                  <span className="rounded-full border border-[var(--auth-accent)]/25 bg-[var(--auth-accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--auth-accent)]">
                    TikTok
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {isStaffPicker ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || pending}
                      onClick={() => elegirCliente(client, true)}
                      className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--auth-accent)] text-[13px] font-semibold text-white transition-[filter,opacity] hover:brightness-[1.05] disabled:opacity-55"
                    >
                      {busy ? "Entrando…" : "Entrar como este cliente"}
                    </button>
                    <button
                      type="button"
                      disabled={busy || pending}
                      onClick={() => elegirCliente(client, false)}
                      className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-[var(--auth-control-border)] bg-white text-[13px] font-semibold text-[var(--auth-text)] transition-colors hover:border-[var(--auth-accent)] hover:text-[var(--auth-accent)] disabled:opacity-55"
                    >
                      Operar como gerente
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy || pending}
                    onClick={() => elegirCliente(client)}
                    className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--auth-accent)] text-[13px] font-semibold text-white transition-[filter,opacity] hover:brightness-[1.05] disabled:opacity-55"
                  >
                    {busy ? "Eligiendo…" : "Operar este cliente"}
                  </button>
                )}
                <Link
                  href={`/clientes/${client.id}`}
                  className="text-center text-[12px] font-semibold text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-accent)]"
                >
                  Ver ficha
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
