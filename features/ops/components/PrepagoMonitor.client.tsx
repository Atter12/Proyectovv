"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MonitorAccount,
  MonitorCliente,
  MonitorEvent,
  MonitorSeverity,
  MonitorSignal,
  MonitorSnapshot,
} from "@/features/ops/types/prepago-monitor";

const AUTO_REFRESH_MS = 5 * 60_000;

type SeverityFilter = "all" | MonitorSeverity;
type Tab = "clientes" | "movimientos";

const SEVERITY_META: Record<
  MonitorSeverity,
  { label: string; dot: string; chip: string; ring: string; text: string }
> = {
  critical: {
    label: "Crítico",
    dot: "bg-[#c2410c]",
    chip: "bg-[#fdecea] text-[#9f1d12]",
    ring: "ring-[#f5c6bf]",
    text: "text-[#9f1d12]",
  },
  high: {
    label: "Alto",
    dot: "bg-[#d47840]",
    chip: "bg-[#fff1e6] text-[#9a4a17]",
    ring: "ring-[#f3d6bf]",
    text: "text-[#9a4a17]",
  },
  medium: {
    label: "Atención",
    dot: "bg-[#c9a227]",
    chip: "bg-[#fbf5df] text-[#7a5f0e]",
    ring: "ring-[#efe2b3]",
    text: "text-[#7a5f0e]",
  },
  info: {
    label: "En orden",
    dot: "bg-[#3f8f5b]",
    chip: "bg-[#eaf5ee] text-[#276043]",
    ring: "ring-[#cfe7d8]",
    text: "text-[#276043]",
  },
};

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdShort = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function usd(value: number | null | undefined): string {
  return usdFmt.format(Number(value) || 0);
}

function relativeTime(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}

function limaDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function SeverityChip({ severity, compact = false }: { severity: MonitorSeverity; compact?: boolean }) {
  const meta = SEVERITY_META[severity];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold ${meta.chip} ${
        compact ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11px]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}

function BmBadge({ bm }: { bm: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-[#f5f0ea] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-[#5c564e]">
      BM{bm}
    </span>
  );
}

async function fetchSnapshot(fresh: boolean, signal: AbortSignal): Promise<MonitorSnapshot> {
  const res = await fetch(`/api/ops/monitor${fresh ? "?fresh=1" : ""}`, {
    cache: "no-store",
    signal,
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    snapshot?: MonitorSnapshot;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.snapshot) {
    throw new Error(json.error || "No se pudo cargar el monitoreo.");
  }
  return json.snapshot;
}

function isAbort(err: unknown): boolean {
  return (err as { name?: string })?.name === "AbortError";
}

export function PrepagoMonitor({
  initialSnapshot = null,
  initialTab = "clientes",
  initialOpenId = null,
}: {
  /** Si viene, se muestra sin esperar la primera carga (vista previa / tests). */
  initialSnapshot?: MonitorSnapshot | null;
  initialTab?: Tab;
  initialOpenId?: string | null;
} = {}) {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(initialSnapshot);
  const [loading, setLoading] = useState(initialSnapshot == null);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const abortRef = useRef<AbortController | null>(null);

  /** Recarga pedida por el gerente o por el auto-refresh (fuera del render). */
  const load = useCallback(async (fresh: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchSnapshot(fresh, controller.signal));
    } catch (err) {
      if (isAbort(err)) return;
      setError(err instanceof Error ? err.message : "No se pudo cargar el monitoreo.");
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSnapshot) return;
    const controller = new AbortController();
    abortRef.current = controller;
    fetchSnapshot(false, controller.signal)
      .then((data) => setSnapshot(data))
      .catch((err) => {
        if (!isAbort(err)) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el monitoreo.");
        }
      })
      .finally(() => {
        if (abortRef.current === controller) setLoading(false);
      });
    return () => controller.abort();
  }, [initialSnapshot]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [auto, load]);

  const clientes = useMemo(() => {
    const list = snapshot?.clientes ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((c) => {
      if (filter !== "all" && c.severity !== filter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [snapshot, filter, query]);

  const events = useMemo(() => {
    const list = snapshot?.events ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((e) => {
      if (filter !== "all" && e.severity !== filter) return false;
      if (q && !e.clienteName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [snapshot, filter, query]);

  if (!snapshot && loading) return <MonitorSkeleton />;

  if (!snapshot) {
    return (
      <div className="rounded-[22px] bg-white px-5 py-10 text-center ring-1 ring-[#e8dfd4]">
        <p className="text-[14px] font-semibold text-[#1a1714]">No se pudo cargar el monitoreo</p>
        <p className="mt-1 text-[13px] text-[#9a3412]">{error}</p>
        <button
          type="button"
          onClick={() => void load(true)}
          className="mt-4 rounded-full bg-[#1a1714] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#2c2723]"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const t = snapshot.totals;
  const atRisk = t.critical + t.high;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Barra de estado */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#6b645c]">
          <span className="relative flex h-2 w-2" aria-hidden>
            {auto ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3f8f5b] opacity-50" />
            ) : null}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${auto ? "bg-[#3f8f5b]" : "bg-[#a39b92]"}`} />
          </span>
          Actualizado {relativeTime(snapshot.generatedAt, now)} · {limaDateTime(snapshot.generatedAt)}
          <span className="text-[#a39b92]">
            · {t.clientes} clientes · {t.accounts} cuentas
          </span>
        </p>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[#3f3a34] ring-1 ring-[#e8dfd4]">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#d47840]"
            />
            Auto cada 5 min
          </label>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1a1714] px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#2c2723] disabled:opacity-60"
          >
            <svg
              viewBox="0 0 20 20"
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              aria-hidden
            >
              <path
                d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6M16.5 3.5v3.5H13"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {loading ? "Revisando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl bg-[#fdecea] px-4 py-2.5 text-[12.5px] text-[#9f1d12] ring-1 ring-[#f5c6bf]">
          No se pudo actualizar: {error}. Se muestran los datos anteriores.
        </p>
      ) : null}
      {snapshot.warnings.length ? (
        <p className="rounded-2xl bg-[#fbf5df] px-4 py-2.5 text-[12.5px] text-[#7a5f0e] ring-1 ring-[#efe2b3]">
          Datos incompletos: {snapshot.warnings.join(" · ")}
        </p>
      ) : null}

      {/* Resumen */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
        <div className="relative min-w-0 overflow-hidden rounded-[22px] bg-[#1a1714] p-5 text-white sm:p-6">
          <div
            className={`pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full blur-2xl ${
              atRisk ? "bg-[#d47840]/30" : "bg-[#3f8f5b]/30"
            }`}
            aria-hidden
          />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f0b889]">
              Ahora mismo
            </p>
            <p className="mt-2 text-[2.1rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {usdShort.format(t.exposureUsd)}
            </p>
            <p className="mt-1.5 text-[13px] text-white/70">
              pueden gastarse en TikTok sin un pago detrás
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(["critical", "high", "medium", "info"] as const).map((sev) => {
                const n = sev === "critical" ? t.critical : sev === "high" ? t.high : sev === "medium" ? t.medium : t.ok;
                const active = filter === sev;
                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setFilter(active ? "all" : sev)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                      active ? "bg-white text-[#1a1714]" : "bg-white/10 text-white hover:bg-white/15"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${SEVERITY_META[sev].dot}`} aria-hidden />
                    {SEVERITY_META[sev].label}
                    <span className="tabular-nums opacity-80">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi
            label="Deuda del mes"
            value={usdShort.format(t.monthDebtUsd)}
            hint={`Gastaron más de lo pagado (${snapshot.month})`}
            tone={t.monthDebtUsd > 0 ? "warn" : "ok"}
          />
          <Kpi
            label="Cargas directas en TikTok"
            value={usdShort.format(t.manualLoadUsd)}
            hint={`Sin pasar por Ads Holistic · ${snapshot.windows.manualLoadHours} h`}
            tone={t.manualLoadUsd > 0 ? "bad" : "ok"}
          />
          <Kpi
            label="Recargas de gerente"
            value={usdShort.format(t.staffRechargeUsd)}
            hint={`Sin pago del cliente · ${snapshot.windows.staffMovesDays} días`}
            tone={t.staffRechargeUsd > 0 ? "warn" : "ok"}
          />
          <Kpi
            label="Cuentas sin tope"
            value={String(t.unlimitedAccounts)}
            hint={
              t.tiktokImportUsd > 0
                ? `+ ${usdShort.format(t.tiktokImportUsd)} de cupo pasado a cartera`
                : "BM10/30 en ilimitado"
            }
            tone={t.unlimitedAccounts > 0 ? "bad" : t.tiktokImportUsd > 0 ? "warn" : "ok"}
          />
        </div>
      </section>

      {/* Pestañas y búsqueda */}
      <section className="min-w-0 overflow-hidden rounded-[22px] bg-white ring-1 ring-[#e8dfd4]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efe8df] px-4 py-3">
          <div className="flex rounded-full bg-[#f5f0ea] p-1" role="tablist">
            {(
              [
                ["clientes", `Clientes`, clientes.length],
                ["movimientos", `Movimientos raros`, events.length],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                  tab === key ? "bg-white text-[#1a1714] shadow-sm" : "text-[#6b645c] hover:text-[#1a1714]"
                }`}
              >
                {label} <span className="tabular-nums text-[#a39b92]">{n}</span>
              </button>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            {filter !== "all" ? (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="inline-flex items-center gap-1 rounded-full bg-[#f5f0ea] px-2.5 py-1 text-[11.5px] font-semibold text-[#5c564e] hover:bg-[#ece5dc]"
              >
                {SEVERITY_META[filter].label} ✕
              </button>
            ) : null}
            <div className="relative w-full max-w-[16rem]">
              <svg
                viewBox="0 0 20 20"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a39b92]"
                fill="none"
                aria-hidden
              >
                <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="m13.2 13.2 3.3 3.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente"
                aria-label="Buscar cliente"
                className="h-9 w-full rounded-full border border-[#ece7e0] bg-[#faf8f5] pl-9 pr-4 text-[13px] text-[#1a1714] outline-none transition placeholder:text-[#a39b92] focus:border-[#d47840] focus:bg-white focus-visible:ring-2 focus-visible:ring-[#d47840]/30"
              />
            </div>
          </div>
        </div>

        {tab === "clientes" ? (
          <ClientesList
            clientes={clientes}
            openId={openId}
            onToggle={(id) => setOpenId((prev) => (prev === id ? null : id))}
          />
        ) : (
          <EventsList events={events} now={now} />
        )}
      </section>

      <p className="px-1 text-[11.5px] leading-5 text-[#a39b92]">
        Solo lectura: esta pantalla no cambia nada en TikTok ni en la cartera. «Puede gastar sin
        pagar» = lo que TikTok le deja gastar menos lo que tiene pagado en cartera. Cargas directas:
        plata que entró a sus cuentas cash (BM200/300) sin recarga en Ads Holistic.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "ok" | "warn" | "bad";
}) {
  const color = tone === "bad" ? "text-[#9f1d12]" : tone === "warn" ? "text-[#9a4a17]" : "text-[#1a1714]";
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-[18px] bg-white p-4 ring-1 ring-[#e8dfd4]">
      <p className="text-[11.5px] font-semibold leading-4 text-[#6b645c]">{label}</p>
      <p className={`mt-3 text-[1.45rem] font-semibold leading-none tracking-[-0.02em] tabular-nums ${color}`}>
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-4 text-[#a39b92]">{hint}</p>
    </div>
  );
}

function ClientesList({
  clientes,
  openId,
  onToggle,
}: {
  clientes: MonitorCliente[];
  openId: string | null;
  onToggle: (id: string) => void;
}) {
  if (clientes.length === 0) {
    return <EmptyState text="Ningún cliente con ese filtro." />;
  }
  return (
    <div>
      <div className="hidden grid-cols-[minmax(0,2.2fr)_repeat(4,minmax(0,1fr))_minmax(0,2.2fr)] gap-3 border-b border-[#f3eee8] bg-[#fcfaf7] px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#a39b92] lg:grid">
        <span>Cliente</span>
        <span className="text-right">Puede gastar sin pagar</span>
        <span className="text-right">Cartera</span>
        <span className="text-right">Deuda del mes</span>
        <span className="text-right">Gasto ayer</span>
        <span>Lo más urgente</span>
      </div>
      <ul className="divide-y divide-[#f3eee8]">
        {clientes.map((c) => (
          <ClienteRow key={c.id} cliente={c} open={openId === c.id} onToggle={() => onToggle(c.id)} />
        ))}
      </ul>
    </div>
  );
}

function ClienteRow({
  cliente,
  open,
  onToggle,
}: {
  cliente: MonitorCliente;
  open: boolean;
  onToggle: () => void;
}) {
  const top = cliente.signals.find((s) => s.severity !== "info") ?? null;
  const meta = SEVERITY_META[cliente.severity];
  return (
    <li className={open ? "bg-[#fffaf5]" : undefined}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-left transition hover:bg-[#fcfaf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d47840]/40 lg:grid-cols-[minmax(0,2.2fr)_repeat(4,minmax(0,1fr))_minmax(0,2.2fr)] lg:items-center lg:gap-3"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="relative shrink-0">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f7f0e9] text-[11px] font-bold text-[#b85f2e]"
              aria-hidden
            >
              {initialsOf(cliente.name)}
            </span>
            <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-white ${meta.dot}`} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-[14px] font-semibold text-[#1a1714]">{cliente.name}</span>
              <SeverityChip severity={cliente.severity} compact />
            </span>
            <span className="mt-0.5 block text-[11.5px] text-[#a39b92]">
              {cliente.accounts.length} cuenta{cliente.accounts.length === 1 ? "" : "s"}
              {cliente.hasLogin ? " · con login" : " · sin login"}
            </span>
          </span>
        </span>
        <MetricCell label="Puede gastar sin pagar" value={cliente.exposureUsd} strong={cliente.exposureUsd > 1} />
        <MetricCell label="Cartera" value={cliente.walletUsd} />
        <MetricCell label="Deuda del mes" value={Math.max(0, cliente.month.debtUsd)} strong={cliente.month.debtUsd > 1} />
        <MetricCell label="Gasto ayer" value={cliente.spendYesterdayUsd} />
        <span className="flex min-w-0 items-center gap-2">
          {top ? (
            <span className={`truncate text-[12.5px] font-medium ${SEVERITY_META[top.severity].text}`}>{top.title}</span>
          ) : (
            <span className="text-[12.5px] text-[#276043]">Sin alertas</span>
          )}
          <svg
            viewBox="0 0 20 20"
            className={`ml-auto h-4 w-4 shrink-0 text-[#a39b92] transition ${open ? "rotate-90" : ""}`}
            fill="none"
            aria-hidden
          >
            <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? <ClienteDetail cliente={cliente} /> : null}
    </li>
  );
}

function MetricCell({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <span className="flex items-baseline justify-between gap-2 lg:block lg:text-right">
      <span className="text-[11.5px] text-[#a39b92] lg:hidden">{label}</span>
      <span className={`text-[13px] tabular-nums ${strong ? "font-semibold text-[#9f1d12]" : "text-[#3f3a34]"}`}>
        {usd(value)}
      </span>
    </span>
  );
}

function ClienteDetail({ cliente }: { cliente: MonitorCliente }) {
  const signals = cliente.signals;
  return (
    <div className="grid gap-4 px-4 pb-5 pt-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">Qué pasa</p>
        {signals.length === 0 ? (
          <p className="rounded-2xl bg-[#eaf5ee] px-3.5 py-3 text-[12.5px] text-[#276043]">
            Todo en orden: no puede gastar más de lo que pagó.
          </p>
        ) : (
          signals.map((s, i) => <SignalCard key={`${s.kind}-${s.advertiserId ?? i}-${i}`} signal={s} />)
        )}
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 ring-1 ring-[#efe8df]">
          <MiniStat label="Cargo del mes" value={cliente.month.chargeUsd} />
          <MiniStat label="Cobrado" value={cliente.month.paidUsd} />
          <MiniStat label="Diferencia" value={cliente.month.debtUsd} danger={cliente.month.debtUsd > 1} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">Cuentas TikTok</p>
        <AccountsTable accounts={cliente.accounts} />
      </div>
    </div>
  );
}

function SignalCard({ signal }: { signal: MonitorSignal }) {
  const meta = SEVERITY_META[signal.severity];
  return (
    <div className={`rounded-2xl bg-white px-3.5 py-3 ring-1 ${meta.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[13px] font-semibold ${meta.text}`}>{signal.title}</p>
          <p className="mt-0.5 text-[12.5px] leading-5 text-[#3f3a34]">{signal.detail}</p>
        </div>
        {signal.amountUsd != null ? (
          <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${meta.text}`}>{usd(signal.amountUsd)}</span>
        ) : (
          <SeverityChip severity={signal.severity} compact />
        )}
      </div>
      <p className="mt-2 flex gap-1.5 text-[12px] leading-5 text-[#6b645c]">
        <span aria-hidden>→</span>
        {signal.action}
      </p>
    </div>
  );
}

function MiniStat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] text-[#a39b92]">{label}</p>
      <p className={`mt-0.5 text-[13px] font-semibold tabular-nums ${danger ? "text-[#9f1d12]" : "text-[#1a1714]"}`}>
        {usd(value)}
      </p>
    </div>
  );
}

function AccountsTable({ accounts }: { accounts: MonitorAccount[] }) {
  if (accounts.length === 0) {
    return <p className="text-[12.5px] text-[#6b645c]">Sin cuentas vinculadas en TikTok.</p>;
  }
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-[#efe8df]">
      <div className="max-h-[22rem] overflow-y-auto">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 bg-[#fcfaf7] text-[10.5px] uppercase tracking-[0.06em] text-[#a39b92]">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Cuenta</th>
              <th className="px-3 py-2 text-right font-semibold">Puede gastar</th>
              <th className="px-3 py-2 text-right font-semibold">Cartera</th>
              <th className="px-3 py-2 text-right font-semibold">Sin pago</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f3eee8] bg-white">
            {accounts.map((a) => {
              const risky = a.unlimited || (a.excessUsd ?? 0) > 1;
              return (
                <tr key={a.advertiserId} className={a.status === "banned" ? "opacity-55" : undefined}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <BmBadge bm={a.bm} />
                      <span className="truncate font-medium text-[#1a1714]" title={a.name}>
                        {a.name}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-[#a39b92]">
                      {a.status === "banned" ? "Baneada · " : ""}
                      {a.kind === "cash" ? "Cash" : "Cupo compartido"} · adv {a.advertiserId}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#3f3a34]">
                    {a.unlimited ? <span className="font-semibold text-[#9f1d12]">Sin tope</span> : usd(a.spendableUsd)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#3f3a34]">{usd(a.walletUsd)}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      risky && a.status !== "banned" ? "font-semibold text-[#9f1d12]" : "text-[#a39b92]"
                    }`}
                  >
                    {a.unlimited ? "∞" : usd(a.excessUsd)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventsList({ events, now }: { events: MonitorEvent[]; now: number }) {
  if (events.length === 0) {
    return <EmptyState text="Sin movimientos raros en la ventana revisada." />;
  }
  return (
    <ol className="relative px-4 py-4">
      <span className="absolute bottom-6 left-[1.9rem] top-6 w-px bg-[#efe8df]" aria-hidden />
      {events.map((e) => {
        const meta = SEVERITY_META[e.severity];
        return (
          <li key={e.id} className="relative flex gap-4 py-2.5">
            <span
              className={`relative z-10 mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white ring-1 ${meta.ring}`}
              aria-hidden
            >
              <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
            </span>
            <div className="min-w-0 flex-1 rounded-2xl bg-[#fcfaf7] px-3.5 py-2.5 ring-1 ring-[#f3eee8]">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-[13px] font-semibold text-[#1a1714]">
                  {e.clienteName}
                  <span className={`ml-2 font-medium ${meta.text}`}>{e.title}</span>
                </p>
                <span className="text-[11.5px] tabular-nums text-[#a39b92]" title={limaDateTime(e.at)}>
                  {relativeTime(e.at, now)}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-5 text-[#3f3a34]">{e.detail}</p>
              {e.actor ? <p className="mt-1 text-[11.5px] text-[#6b645c]">Hecho por {e.actor}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-[13px] text-[#6b645c]">{text}</p>;
}

function MonitorSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-label="Cargando monitoreo">
      <div className="h-4 w-64 rounded-full bg-[#efe8df]" />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
        <div className="h-44 rounded-[22px] bg-[#e8e1d8]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-[18px] bg-white ring-1 ring-[#e8dfd4]" />
          ))}
        </div>
      </div>
      <div className="h-80 rounded-[22px] bg-white ring-1 ring-[#e8dfd4]" />
      <p className="text-center text-[12px] text-[#a39b92]">
        Revisando TikTok, cartera y Hecom… tarda unos segundos.
      </p>
    </div>
  );
}
