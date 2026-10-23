"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
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
  billingModality?: "credito" | "prepago";
};

type ViewMode = "list" | "cards";
type SortKey = "az" | "za" | "tiktok" | "contacts" | "balance";
type ModalityFilter = "all" | "credito" | "prepago";
type TikTokFilter = "all" | "with" | "without";

const SORT_LABELS: Record<SortKey, string> = {
  az: "Nombre A → Z",
  za: "Nombre Z → A",
  tiktok: "Más cuentas TikTok",
  contacts: "Más contactos",
  balance: "Mayor saldo en cartera",
};

/** Preferencias por persona (vista y orden); si el navegador no deja guardar, se usa el default. */
const PREFS_KEY = "clientes.list.prefs.v1";

type Prefs = { view: ViewMode; sort: SortKey };

// Sin almacenamiento (modo privado, bloqueado): la preferencia dura solo esta visita.
let memoryPrefs: string | null = null;
const prefsListeners = new Set<() => void>();

function subscribePrefs(listener: () => void) {
  prefsListeners.add(listener);
  return () => {
    prefsListeners.delete(listener);
  };
}

function readPrefsRaw(): string | null {
  try {
    return window.localStorage.getItem(PREFS_KEY) ?? memoryPrefs;
  } catch {
    return memoryPrefs;
  }
}

function parsePrefs(raw: string | null): Prefs {
  try {
    const parsed = JSON.parse(raw ?? "{}") as Partial<Prefs>;
    return {
      view: parsed.view === "cards" ? "cards" : "list",
      sort: parsed.sort && parsed.sort in SORT_LABELS ? parsed.sort : "az",
    };
  } catch {
    return { view: "list", sort: "az" };
  }
}

function writePrefs(prefs: Prefs) {
  memoryPrefs = JSON.stringify(prefs);
  try {
    window.localStorage.setItem(PREFS_KEY, memoryPrefs);
  } catch {
    // Queda en memoria.
  }
  prefsListeners.forEach((listener) => listener());
}

function displayName(client: ClientRow): string {
  return client.contactName?.trim() || client.contactEmail || client.name;
}

function hasTikTokAccounts(client: ClientRow): boolean {
  return Boolean(client.tiktokAdvertiserId) || (client.tiktokAccounts?.length ?? 0) > 0;
}

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
  const prefsRaw = useSyncExternalStore(subscribePrefs, readPrefsRaw, () => null);
  const { view, sort } = useMemo(() => parsePrefs(prefsRaw), [prefsRaw]);
  const [modality, setModality] = useState<ModalityFilter>("all");
  const [tiktok, setTikTok] = useState<TikTokFilter>("all");

  function changeView(next: ViewMode) {
    writePrefs({ view: next, sort });
  }

  function changeSort(next: SortKey) {
    writePrefs({ view, sort: next });
  }

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
    const matches = clients.filter((client) => {
      if (modality !== "all" && client.billingModality !== modality) return false;
      if (tiktok === "with" && !hasTikTokAccounts(client)) return false;
      if (tiktok === "without" && hasTikTokAccounts(client)) return false;
      if (!query) return true;
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
    const byName = (a: ClientRow, b: ClientRow) =>
      displayName(a).localeCompare(displayName(b), "es", { sensitivity: "base" });
    return [...matches].sort((a, b) => {
      switch (sort) {
        case "za":
          return byName(b, a);
        case "tiktok":
          return b.adAccountCount - a.adAccountCount || byName(a, b);
        case "contacts":
          return b.activeMemberCount - a.activeMemberCount || byName(a, b);
        case "balance":
          return b.walletBalanceCents - a.walletBalanceCents || byName(a, b);
        default:
          return byName(a, b);
      }
    });
  }, [payload?.clients, q, modality, tiktok, sort]);

  const filtersActive = modality !== "all" || tiktok !== "all";

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
          {isStaffPicker ? "Elige un cliente" : "Elegir cliente"}
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
            {payload.error ?? "Error desconocido. Reintenta en unos segundos."}
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

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div
            role="radiogroup"
            aria-label="Vista"
            className="inline-flex h-9 rounded-lg border border-[var(--auth-input-border)] bg-[var(--auth-bg)] p-0.5"
          >
            {(["list", "cards"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={view === option}
                onClick={() => changeView(option)}
                className={`rounded-md px-3 text-[12px] font-semibold transition-colors ${
                  view === option
                    ? "bg-white text-[var(--auth-text)] shadow-sm"
                    : "text-[var(--auth-text-muted)] hover:text-[var(--auth-text)]"
                }`}
              >
                {option === "list" ? "Lista" : "Tarjetas"}
              </button>
            ))}
          </div>

          <ToolbarSelect
            label="Ordenar"
            value={sort}
            onChange={(value) => changeSort(value as SortKey)}
            options={(Object.keys(SORT_LABELS) as SortKey[]).map((key) => [key, SORT_LABELS[key]])}
          />
          <ToolbarSelect
            label="Modalidad"
            value={modality}
            onChange={(value) => setModality(value as ModalityFilter)}
            options={[
              ["all", "Todas"],
              ["credito", "Crédito"],
              ["prepago", "Prepago"],
            ]}
          />
          <ToolbarSelect
            label="TikTok"
            value={tiktok}
            onChange={(value) => setTikTok(value as TikTokFilter)}
            options={[
              ["all", "Todos"],
              ["with", "Con cuentas"],
              ["without", "Sin cuentas"],
            ]}
          />

          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setModality("all");
                setTikTok("all");
              }}
              className="h-9 px-1.5 text-[12px] font-semibold text-[var(--auth-accent)] hover:underline"
            >
              Quitar filtros
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="dashboard-surface-card rounded-[1rem] p-8 text-center text-[14px] font-medium text-[var(--auth-text-muted)]">
          Cargando clientes…
        </div>
      ) : null}

      {!loading && payload?.ok && filtered.length === 0 ? (
        <div className="dashboard-surface-card rounded-[1rem] p-10 text-center text-[14px] font-medium text-[var(--auth-text-muted)]">
          {q.trim() || filtersActive
            ? "Ningún cliente coincide con la búsqueda o los filtros."
            : "No hay clientes Hecom para mostrar."}
        </div>
      ) : null}

      {filtered.length > 0 && view === "list" ? (
        <ul className="divide-y divide-[var(--auth-divider)] overflow-hidden rounded-lg border border-[var(--auth-border)] bg-white">
          {filtered.map((client) => (
            <li
              key={client.id}
              className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-[var(--auth-bg)] lg:flex-row lg:items-center lg:gap-4 lg:px-5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <HecomClienteAvatar name={displayName(client)} avatarUrl={client.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[14px] font-bold tracking-[-0.01em] text-[var(--auth-text)]">
                    {displayName(client)}
                  </h2>
                  <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--auth-text-muted)]">
                    {client.biz ? `${client.biz} · ` : ""}
                    {client.contactEmail ?? client.slug}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:w-[22rem] lg:flex-none">
                <dl className="flex items-center gap-4 text-[12px]">
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                      TikTok
                    </dt>
                    <dd className="font-bold tabular-nums text-[var(--auth-text)]">{client.adAccountCount}</dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                      Contactos
                    </dt>
                    <dd className="font-bold tabular-nums text-[var(--auth-text)]">{client.activeMemberCount}</dd>
                  </div>
                </dl>
                <ClientBadges client={client} />
              </div>
              <ClientActions
                client={client}
                staffPicker={isStaffPicker}
                busy={pending && selectingId === client.id}
                pending={pending}
                onPick={elegirCliente}
                compact
              />
            </li>
          ))}
        </ul>
      ) : null}

      {filtered.length > 0 && view === "cards" ? (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => (
            <article
              key={client.id}
              className="flex flex-col rounded-lg border border-[var(--auth-border)] bg-white p-4 transition-colors hover:border-[var(--auth-text-soft)] sm:p-5"
            >
              <div className="flex items-start gap-3">
                <HecomClienteAvatar name={displayName(client)} avatarUrl={client.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[1rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                    {displayName(client)}
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
              <div className="mt-3">
                <ClientBadges client={client} />
              </div>
              <div className="mt-4">
                <ClientActions
                  client={client}
                  staffPicker={isStaffPicker}
                  busy={pending && selectingId === client.id}
                  pending={pending}
                  onPick={elegirCliente}
                />
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToolbarSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-[var(--auth-input-border)] bg-white px-2.5 text-[13px] font-medium text-[var(--auth-text)] transition-[border-color,box-shadow] hover:border-[var(--auth-input-border-hover)] focus:border-[var(--auth-accent)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/20"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ClientBadges({ client }: { client: ClientRow }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {client.billingModality === "credito" ? (
        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-amber-900">
          Crédito
        </span>
      ) : client.billingModality === "prepago" ? (
        <span className="rounded-full border border-[var(--auth-border)] bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--auth-text-muted)]">
          Prepago
        </span>
      ) : null}
      {hasTikTokAccounts(client) ? (
        <span className="rounded-full border border-[var(--auth-accent)]/25 bg-[var(--auth-accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--auth-accent)]">
          TikTok
        </span>
      ) : null}
    </div>
  );
}

/** Botones de una fila o tarjeta. `compact`: en línea (lista); si no, a lo ancho (tarjeta). */
function ClientActions({
  client,
  staffPicker,
  busy,
  pending,
  onPick,
  compact = false,
}: {
  client: ClientRow;
  staffPicker: boolean;
  busy: boolean;
  pending: boolean;
  onPick: (client: ClientRow, actAsCliente?: boolean) => void;
  compact?: boolean;
}) {
  const size = compact ? "h-9 px-3.5 text-[12px]" : "h-10 w-full text-[13px]";
  const primary = `inline-flex ${size} items-center justify-center rounded-lg bg-[var(--auth-accent)] font-semibold text-white transition-[filter,opacity] hover:brightness-[1.05] disabled:opacity-55`;
  const secondary = `inline-flex ${size} items-center justify-center rounded-lg border border-[var(--auth-control-border)] bg-white font-semibold text-[var(--auth-text)] transition-colors hover:border-[var(--auth-accent)] hover:text-[var(--auth-accent)] disabled:opacity-55`;
  return (
    <div className={compact ? "flex flex-wrap items-center gap-2 lg:flex-none" : "flex flex-col gap-2"}>
      {staffPicker ? (
        <>
          <button type="button" disabled={busy || pending} onClick={() => onPick(client, true)} className={primary}>
            {busy ? "Entrando…" : "Entrar como cliente"}
          </button>
          <button type="button" disabled={busy || pending} onClick={() => onPick(client, false)} className={secondary}>
            Operar como gerente
          </button>
        </>
      ) : (
        <button type="button" disabled={busy || pending} onClick={() => onPick(client)} className={primary}>
          {busy ? "Eligiendo…" : "Operar este cliente"}
        </button>
      )}
      <Link
        href={`/clientes/${client.id}`}
        className={`${compact ? "px-1.5" : "text-center"} text-[12px] font-semibold text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-accent)]`}
      >
        Ver ficha
      </Link>
    </div>
  );
}
