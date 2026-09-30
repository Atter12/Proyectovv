"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  VERDICT_META,
  VERDICT_ORDER,
  verdictFor,
  type Verdict,
  type VerdictKey,
} from "@/features/ops/lib/monitor-verdict";
import type {
  ClienteModalidad,
  ClienteModalidadEntry,
  MonitorAccount,
  MonitorCliente,
  MonitorEvent,
  MonitorSeverity,
  MonitorSignal,
  MonitorSnapshot,
} from "@/features/ops/types/prepago-monitor";

const AUTO_REFRESH_MS = 5 * 60_000;

type VerdictFilter = "all" | VerdictKey;
type Tab = "clientes" | "movimientos";
type Modalidades = Record<string, ClienteModalidadEntry>;

type Row = {
  cliente: MonitorCliente;
  modalidad: ClienteModalidad;
  modalidadEntry: ClienteModalidadEntry | null;
  verdict: Verdict;
};

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
    label: "Info",
    dot: "bg-[#a39b92]",
    chip: "bg-[#f5f0ea] text-[#5c564e]",
    ring: "ring-[#ece5dc]",
    text: "text-[#5c564e]",
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

function VerdictChip({ verdict, compact = false }: { verdict: VerdictKey; compact?: boolean }) {
  const meta = VERDICT_META[verdict];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold ${meta.chip} ${
        compact ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {compact ? meta.short : meta.label}
    </span>
  );
}

function ModalidadBadge({ modalidad }: { modalidad: ClienteModalidad }) {
  return modalidad === "acuerdo" ? (
    <span className="inline-flex shrink-0 items-center rounded-md bg-[#ebf0fa] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#2f4a86]">
      Paga después
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-md bg-[#f5f0ea] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#5c564e]">
      Prepago
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

async function fetchSnapshot(
  fresh: boolean,
  signal: AbortSignal,
): Promise<{ snapshot: MonitorSnapshot; modalidades: Modalidades }> {
  const res = await fetch(`/api/ops/monitor${fresh ? "?fresh=1" : ""}`, {
    cache: "no-store",
    signal,
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    snapshot?: MonitorSnapshot;
    modalidades?: Modalidades;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.snapshot) {
    throw new Error(json.error || "No se pudo cargar el monitoreo.");
  }
  return { snapshot: json.snapshot, modalidades: json.modalidades ?? {} };
}

function isAbort(err: unknown): boolean {
  return (err as { name?: string })?.name === "AbortError";
}

export function PrepagoMonitor({
  initialSnapshot = null,
  initialModalidades = {},
  initialTab = "clientes",
  initialOpenId = null,
}: {
  /** Si viene, se muestra sin esperar la primera carga (vista previa / tests). */
  initialSnapshot?: MonitorSnapshot | null;
  initialModalidades?: Modalidades;
  initialTab?: Tab;
  initialOpenId?: string | null;
} = {}) {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(initialSnapshot);
  const [modalidades, setModalidades] = useState<Modalidades>(initialModalidades);
  const [loading, setLoading] = useState(initialSnapshot == null);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<VerdictFilter>("all");
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
      const data = await fetchSnapshot(fresh, controller.signal);
      setSnapshot(data.snapshot);
      setModalidades(data.modalidades);
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
      .then((data) => {
        setSnapshot(data.snapshot);
        setModalidades(data.modalidades);
      })
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

  const rows = useMemo<Row[]>(() => {
    const list = (snapshot?.clientes ?? []).map((cliente) => {
      const entry = modalidades[cliente.id] ?? null;
      const modalidad: ClienteModalidad = entry?.modalidad ?? "prepago";
      return { cliente, modalidad, modalidadEntry: entry, verdict: verdictFor(cliente, modalidad) };
    });
    const weight = (r: Row) =>
      r.cliente.exposureUsd + Math.max(0, r.cliente.month.debtUsd);
    return list.sort(
      (a, b) =>
        VERDICT_ORDER.indexOf(a.verdict.key) - VERDICT_ORDER.indexOf(b.verdict.key) ||
        weight(b) - weight(a),
    );
  }, [snapshot, modalidades]);

  const counts = useMemo(() => {
    const out: Record<VerdictKey, number> = { quitar_saldo: 0, preguntar: 0, cobrar: 0, acuerdo: 0, ok: 0 };
    for (const r of rows) out[r.verdict.key] += 1;
    return out;
  }, [rows]);

  const modalidadById = useMemo(() => new Map(rows.map((r) => [r.cliente.id, r.modalidad])), [rows]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.verdict.key !== filter) return false;
      if (q && !r.cliente.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, query]);

  const events = useMemo(() => {
    const list = snapshot?.events ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((e) => !q || e.clienteName.toLowerCase().includes(q));
  }, [snapshot, query]);

  const saveModalidad = useCallback(
    async (clienteId: string, modalidad: ClienteModalidad, nota: string) => {
      const res = await fetch("/api/ops/cliente-modalidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, modalidad, nota }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        entry?: ClienteModalidadEntry;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.entry) throw new Error(json.error || "No se pudo guardar.");
      setModalidades((prev) => ({ ...prev, [clienteId]: json.entry! }));
    },
    [],
  );

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
  const prepagoExposure = rows
    .filter((r) => r.modalidad === "prepago")
    .reduce((s, r) => s + r.cliente.exposureUsd, 0);
  const acuerdoExposure = rows
    .filter((r) => r.modalidad === "acuerdo")
    .reduce((s, r) => s + r.cliente.exposureUsd, 0);
  const actionable = counts.quitar_saldo + counts.preguntar + counts.cobrar;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <RefreshBar active={loading} />

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
            <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" aria-hidden>
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

      <HowToRead />

      {/* Resumen: qué hay que hacer hoy */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
        <div className="relative min-w-0 overflow-hidden rounded-[22px] bg-[#1a1714] p-5 text-white sm:p-6">
          <div
            className={`pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full blur-2xl ${
              actionable ? "bg-[#d47840]/30" : "bg-[#3f8f5b]/30"
            }`}
            aria-hidden
          />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f0b889]">Hoy hay que</p>
            <p className="mt-2 text-[2.1rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {actionable} cliente{actionable === 1 ? "" : "s"}
            </p>
            <p className="mt-1.5 text-[13px] text-white/70">
              {actionable
                ? `para revisar. Clientes prepago pueden gastar ${usdShort.format(prepagoExposure)} sin haber pagado.`
                : "sin pendientes. Todos gastan solo lo que pagaron."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {VERDICT_ORDER.map((key) => {
                const active = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setFilter(active ? "all" : key);
                      setTab("clientes");
                    }}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                      active ? "bg-white text-[#1a1714]" : "bg-white/10 text-white hover:bg-white/15"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${VERDICT_META[key].dot}`} aria-hidden />
                    {VERDICT_META[key].short}
                    <span className="tabular-nums opacity-80">{counts[key]}</span>
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
            hint={`Gastaron más de lo que pagaron (${snapshot.month})`}
            tone={t.monthDebtUsd > 0 ? "warn" : "ok"}
          />
          <Kpi
            label="Cargas directas en TikTok"
            value={usdShort.format(t.manualLoadUsd)}
            hint={`No pasaron por Ads Holistic · últimas ${snapshot.windows.manualLoadHours} h`}
            tone={t.manualLoadUsd > 0 ? "bad" : "ok"}
          />
          <Kpi
            label="Recargas de gerente"
            value={usdShort.format(t.staffRechargeUsd)}
            hint={`Sin pago del cliente · últimos ${snapshot.windows.staffMovesDays} días`}
            tone={t.staffRechargeUsd > 0 ? "warn" : "ok"}
          />
          <Kpi
            label="Saldo de clientes con acuerdo"
            value={usdShort.format(acuerdoExposure)}
            hint="Cargado a clientes que pagan después (es normal)"
            tone="ok"
          />
        </div>
      </section>

      {/* Pestañas y búsqueda */}
      <section className="min-w-0 overflow-hidden rounded-[22px] bg-white ring-1 ring-[#e8dfd4]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efe8df] px-4 py-3">
          <div className="flex rounded-full bg-[#f5f0ea] p-1" role="tablist">
            {(
              [
                ["clientes", "Clientes", visibleRows.length],
                ["movimientos", "Movimientos raros", events.length],
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
            {filter !== "all" && tab === "clientes" ? (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="inline-flex items-center gap-1 rounded-full bg-[#f5f0ea] px-2.5 py-1 text-[11.5px] font-semibold text-[#5c564e] hover:bg-[#ece5dc]"
              >
                {VERDICT_META[filter].short} ✕
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
            rows={visibleRows}
            openId={openId}
            onToggle={(id) => setOpenId((prev) => (prev === id ? null : id))}
            onSaveModalidad={saveModalidad}
          />
        ) : (
          <EventsList events={events} now={now} modalidadById={modalidadById} />
        )}
      </section>

      <p className="px-1 text-[11.5px] leading-5 text-[#a39b92]">
        Esta pantalla solo muestra: no cambia nada en TikTok ni en la cartera. Para quitar o poner
        saldo, avisa al gerente.
      </p>
    </div>
  );
}

function HowToRead() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-[22px] bg-white ring-1 ring-[#e8dfd4]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#fff1e6] text-[13px] font-bold text-[#b85f2e]" aria-hidden>
            ?
          </span>
          <span>
            <span className="block text-[13.5px] font-semibold text-[#1a1714]">Cómo leer esta pantalla</span>
            <span className="block text-[12px] text-[#6b645c]">
              Cada cliente tiene un color que dice qué hacer. Toca un cliente para ver los pasos.
            </span>
          </span>
        </span>
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 text-[#a39b92] transition ${open ? "rotate-90" : ""}`}
          fill="none"
          aria-hidden
        >
          <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="grid gap-4 border-t border-[#efe8df] px-5 py-4 lg:grid-cols-2">
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">La regla</p>
            <p className="text-[13px] leading-5 text-[#3f3a34]">
              Un cliente <b>prepago</b> primero paga (recarga) y después gasta. Nunca debería gastar más de
              lo que pagó. Algunos clientes tienen un <b>acuerdo con gerencia</b> y pagan después: a ellos
              es normal verles deuda.
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">Palabras</p>
            <ul className="space-y-1.5 text-[12.5px] leading-5 text-[#3f3a34]">
              <li>
                <b>Cartera:</b> plata que el cliente pagó y todavía no gastó.
              </li>
              <li>
                <b>Puede gastar sin pagar:</b> lo que TikTok le deja gastar menos lo que tiene pagado. Si no es
                $0, puede gastar plata que no pagó.
              </li>
              <li>
                <b>Deuda del mes:</b> lo que gastó (con fee) menos lo que pagó este mes.
              </li>
              <li>
                <b>Carga directa:</b> alguien puso saldo en TikTok sin pasar por Ads Holistic.
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">Los colores</p>
            {(
              [
                ["quitar_saldo", "Puede gastar plata que no pagó. Es un error. Avisar al gerente para quitar ese saldo."],
                ["preguntar", "Alguien le cargó saldo sin que pagara. Preguntar al gerente si estaba autorizado."],
                ["cobrar", "Ya gastó más de lo que pagó este mes. Cobrarle y avisar al gerente."],
                ["acuerdo", "Paga después con acuerdo. Tener deuda es normal. Solo vigilar que pague."],
                ["ok", "Solo gasta lo que pagó. No hacer nada."],
              ] as const
            ).map(([key, text]) => (
              <div key={key} className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 ring-1 ${VERDICT_META[key].ring} ${VERDICT_META[key].soft}`}>
                <VerdictChip verdict={key} />
                <p className="text-[12.5px] leading-5 text-[#3f3a34]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
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
      <p className={`mt-3 text-[1.45rem] font-semibold leading-none tracking-[-0.02em] tabular-nums ${color}`}>{value}</p>
      <p className="mt-2 text-[11px] leading-4 text-[#a39b92]">{hint}</p>
    </div>
  );
}

function ClientesList({
  rows,
  openId,
  onToggle,
  onSaveModalidad,
}: {
  rows: Row[];
  openId: string | null;
  onToggle: (id: string) => void;
  onSaveModalidad: (clienteId: string, modalidad: ClienteModalidad, nota: string) => Promise<void>;
}) {
  if (rows.length === 0) return <EmptyState text="Ningún cliente con ese filtro." />;
  return (
    <div>
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,2.6fr)_repeat(3,minmax(0,1fr))] gap-3 border-b border-[#f3eee8] bg-[#fcfaf7] px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#a39b92] lg:grid">
        <span>Cliente</span>
        <span>Qué pasa</span>
        <span className="text-right">Puede gastar sin pagar</span>
        <span className="text-right">Deuda del mes</span>
        <span className="text-right">Cartera</span>
      </div>
      <ul className="divide-y divide-[#f3eee8]">
        {rows.map((row) => (
          <ClienteRow
            key={row.cliente.id}
            row={row}
            open={openId === row.cliente.id}
            onToggle={() => onToggle(row.cliente.id)}
            onSaveModalidad={onSaveModalidad}
          />
        ))}
      </ul>
    </div>
  );
}

function ClienteRow({
  row,
  open,
  onToggle,
  onSaveModalidad,
}: {
  row: Row;
  open: boolean;
  onToggle: () => void;
  onSaveModalidad: (clienteId: string, modalidad: ClienteModalidad, nota: string) => Promise<void>;
}) {
  const { cliente, verdict, modalidad } = row;
  const meta = VERDICT_META[verdict.key];
  return (
    <li className={open ? meta.soft : undefined}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-left transition hover:bg-[#fcfaf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d47840]/40 lg:grid-cols-[minmax(0,2fr)_minmax(0,2.6fr)_repeat(3,minmax(0,1fr))] lg:items-center lg:gap-3"
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
            <span className="block truncate text-[14px] font-semibold text-[#1a1714]">{cliente.name}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[#a39b92]">
              <ModalidadBadge modalidad={modalidad} />
              {cliente.accounts.length} cuenta{cliente.accounts.length === 1 ? "" : "s"}
            </span>
          </span>
        </span>
        <span className="flex min-w-0 items-start gap-2">
          <span className="min-w-0 flex-1">
            <VerdictChip verdict={verdict.key} />
            <span className="mt-1 block text-[12.5px] leading-5 text-[#3f3a34] lg:line-clamp-2">{verdict.headline}</span>
          </span>
          <svg
            viewBox="0 0 20 20"
            className={`mt-1 h-4 w-4 shrink-0 text-[#a39b92] transition lg:hidden ${open ? "rotate-90" : ""}`}
            fill="none"
            aria-hidden
          >
            <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <MetricCell
          label="Puede gastar sin pagar"
          value={cliente.exposureUsd}
          strong={cliente.exposureUsd > 1 && modalidad === "prepago"}
        />
        <MetricCell
          label="Deuda del mes"
          value={Math.max(0, cliente.month.debtUsd)}
          strong={cliente.month.debtUsd > 1 && modalidad === "prepago"}
        />
        <MetricCell label="Cartera" value={cliente.walletUsd} />
      </button>
      {open ? <ClienteDetail row={row} onSaveModalidad={onSaveModalidad} /> : null}
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

function ClienteDetail({
  row,
  onSaveModalidad,
}: {
  row: Row;
  onSaveModalidad: (clienteId: string, modalidad: ClienteModalidad, nota: string) => Promise<void>;
}) {
  const { cliente, verdict } = row;
  const meta = VERDICT_META[verdict.key];
  const [showTech, setShowTech] = useState(false);
  return (
    <div className="space-y-4 px-4 pb-5 pt-1">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className={`rounded-2xl bg-white p-4 ring-1 ${meta.ring}`}>
          <VerdictChip verdict={verdict.key} />
          <p className="mt-2 text-[14px] font-semibold leading-6 text-[#1a1714]">{verdict.headline}</p>
          {verdict.steps.length ? (
            <>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">Qué hacer</p>
              <ol className="mt-1.5 space-y-2">
                {verdict.steps.map((step, i) => (
                  <li key={step} className="flex gap-2.5 text-[13px] leading-5 text-[#3f3a34]">
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${meta.dot}`}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </div>
        <ModalidadEditor row={row} onSave={onSaveModalidad} />
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 ring-1 ring-[#efe8df] sm:max-w-md">
        <MiniStat label="Gastó este mes (con fee)" value={cliente.month.chargeUsd} />
        <MiniStat label="Pagó este mes" value={cliente.month.paidUsd} />
        <MiniStat label="Diferencia" value={cliente.month.debtUsd} danger={cliente.month.debtUsd > 1} />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowTech((v) => !v)}
          aria-expanded={showTech}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#9a6b4a] hover:text-[#b85f2e]"
        >
          <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 transition ${showTech ? "rotate-90" : ""}`} fill="none" aria-hidden>
            <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {showTech ? "Ocultar detalle técnico" : "Ver detalle técnico (alertas y cuentas TikTok)"}
        </button>
        {showTech ? (
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="space-y-2">
              {cliente.signals.length === 0 ? (
                <p className="rounded-2xl bg-[#eaf5ee] px-3.5 py-3 text-[12.5px] text-[#276043]">Sin alertas.</p>
              ) : (
                cliente.signals.map((s, i) => <SignalCard key={`${s.kind}-${s.advertiserId ?? i}-${i}`} signal={s} />)
              )}
            </div>
            <AccountsTable accounts={cliente.accounts} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModalidadEditor({
  row,
  onSave,
}: {
  row: Row;
  onSave: (clienteId: string, modalidad: ClienteModalidad, nota: string) => Promise<void>;
}) {
  const [modalidad, setModalidad] = useState<ClienteModalidad>(row.modalidad);
  const [nota, setNota] = useState(row.modalidadEntry?.nota ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = modalidad !== row.modalidad || nota.trim() !== (row.modalidadEntry?.nota ?? "");

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await onSave(row.cliente.id, modalidad, nota);
      setMessage({ ok: true, text: "Guardado." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-[#efe8df]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">Tipo de cliente</p>
      <p className="mt-1 text-[12px] leading-5 text-[#6b645c]">Lo decide gerencia. Cambia lo que esta pantalla recomienda.</p>
      <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl bg-[#f5f0ea] p-1" role="radiogroup" aria-label="Tipo de cliente">
        {(
          [
            ["prepago", "Prepago", "Paga antes de gastar"],
            ["acuerdo", "Paga después", "Tiene acuerdo"],
          ] as const
        ).map(([key, label, hint]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={modalidad === key}
            onClick={() => setModalidad(key)}
            className={`rounded-lg px-2.5 py-2 text-left transition ${
              modalidad === key ? "bg-white shadow-sm ring-1 ring-[#e8dfd4]" : "hover:bg-white/60"
            }`}
          >
            <span className="block text-[12.5px] font-semibold text-[#1a1714]">{label}</span>
            <span className="block text-[11px] text-[#6b645c]">{hint}</span>
          </button>
        ))}
      </div>
      <label className="mt-2.5 block">
        <span className="text-[11.5px] font-medium text-[#6b645c]">
          Nota {modalidad === "acuerdo" ? "(obligatoria: quién lo autorizó y cuándo paga)" : "(opcional)"}
        </span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder={modalidad === "acuerdo" ? "Ej: Autorizado por gerencia, paga a fin de mes." : ""}
          className="mt-1 w-full resize-none rounded-xl border border-[#ece7e0] bg-[#faf8f5] px-3 py-2 text-[12.5px] text-[#1a1714] outline-none transition placeholder:text-[#a39b92] focus:border-[#d47840] focus:bg-white"
        />
      </label>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 text-[11px] leading-4 text-[#a39b92]">
          {row.modalidadEntry
            ? `Marcado por ${row.modalidadEntry.updatedBy} · ${limaDateTime(row.modalidadEntry.updatedAt)}`
            : "Sin marcar: se trata como prepago."}
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="shrink-0 rounded-full bg-[#1a1714] px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#2c2723] disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {message ? (
        <p className={`mt-1.5 text-[12px] ${message.ok ? "text-[#276043]" : "text-[#9f1d12]"}`}>{message.text}</p>
      ) : null}
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
        ) : null}
      </div>
    </div>
  );
}

function MiniStat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] leading-4 text-[#a39b92]">{label}</p>
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

function EventsList({
  events,
  now,
  modalidadById,
}: {
  events: MonitorEvent[];
  now: number;
  modalidadById: Map<string, ClienteModalidad>;
}) {
  if (events.length === 0) return <EmptyState text="Sin movimientos raros en la ventana revisada." />;
  return (
    <ol className="relative px-4 py-4">
      <span className="absolute bottom-6 left-[1.9rem] top-6 w-px bg-[#efe8df]" aria-hidden />
      {events.map((e) => {
        const acuerdo = modalidadById.get(e.clienteId) === "acuerdo";
        const meta = acuerdo ? VERDICT_META.acuerdo : SEVERITY_META[e.severity];
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
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-[#1a1714]">
                  {e.clienteName}
                  <ModalidadBadge modalidad={acuerdo ? "acuerdo" : "prepago"} />
                  <span className={`font-medium ${meta.text}`}>{e.title}</span>
                </p>
                <span className="text-[11.5px] tabular-nums text-[#a39b92]" title={limaDateTime(e.at)}>
                  {relativeTime(e.at, now)}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-5 text-[#3f3a34]">{e.detail}</p>
              <p className="mt-1 text-[11.5px] text-[#6b645c]">
                {e.actor ? `Hecho por ${e.actor}. ` : ""}
                {acuerdo
                  ? "Cliente con acuerdo: es normal, solo vigilar."
                  : "Cliente prepago: preguntar al gerente si estaba autorizado."}
              </p>
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

/** Pasos que sigue el servidor, en el orden en que suelen terminar (~15 s en total). */
const LOADING_STEPS: Array<{ at: number; label: string; short: string }> = [
  { at: 0, label: "Leyendo cartera y pagos de Ads Holistic…", short: "Cartera" },
  { at: 2_500, label: "Revisando cuentas TikTok BM10 y BM30…", short: "BM10/30" },
  { at: 6_000, label: "Revisando cuentas cash BM200 y BM300…", short: "BM200/300" },
  { at: 9_500, label: "Buscando cargas directas y recargas de gerente…", short: "Movimientos" },
  { at: 12_500, label: "Cruzando con Hecom y armando alertas…", short: "Alertas" },
];
const EXPECTED_MS = 15_000;

/** Progreso estimado: avanza rápido al inicio y se frena cerca del final (nunca llega a 100 sola). */
function useLoadingProgress(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - started), 200);
    return () => {
      window.clearInterval(id);
      setElapsed(0);
    };
  }, [active]);
  const ratio = elapsed / EXPECTED_MS;
  const percent = Math.min(96, Math.round((1 - Math.exp(-2.2 * ratio)) * 100));
  const step = [...LOADING_STEPS].reverse().find((s) => elapsed >= s.at) ?? LOADING_STEPS[0]!;
  return { percent, step: step.label, stepIndex: LOADING_STEPS.indexOf(step), slow: elapsed > EXPECTED_MS + 8_000 };
}

/** Barra fina animada mientras se actualiza con datos ya en pantalla. */
function RefreshBar({ active }: { active: boolean }) {
  const { percent } = useLoadingProgress(active);
  if (!active) return null;
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-full bg-[#efe8df]"
      role="progressbar"
      aria-label="Actualizando monitoreo"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#d47840] to-[#f0b889] transition-[width] duration-300 ease-out"
        style={{ width: `${Math.max(6, percent)}%` }}
      />
    </div>
  );
}

function MonitorSkeleton() {
  const { percent, step, stepIndex, slow } = useLoadingProgress(true);
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando monitoreo">
      <div className="rounded-[22px] bg-white p-5 ring-1 ring-[#e8dfd4] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-[#1a1714]">Revisando el sistema</p>
          <span className="text-[12px] font-semibold tabular-nums text-[#9a6b4a]">{percent}%</span>
        </div>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#f5f0ea]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de la revisión"
        >
          <div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#d47840] to-[#f0b889] transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(4, percent)}%` }}
          >
            <span className="absolute inset-0 animate-pulse bg-white/25" aria-hidden />
          </div>
        </div>
        <p className="mt-2.5 text-[12.5px] text-[#6b645c]" aria-live="polite">
          {slow ? "Está tardando más de lo normal, TikTok responde lento. Sigue revisando…" : step}
        </p>
        <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {LOADING_STEPS.map((s, i) => (
            <li key={s.label} className="flex items-center gap-1.5 text-[11.5px]">
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                  i < stepIndex
                    ? "bg-[#3f8f5b] text-white"
                    : i === stepIndex
                      ? "bg-[#d47840] text-white"
                      : "bg-[#f5f0ea] text-[#a39b92]"
                }`}
                aria-hidden
              >
                {i < stepIndex ? "✓" : i + 1}
              </span>
              <span className={i <= stepIndex ? "text-[#3f3a34]" : "text-[#a39b92]"}>{s.short}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex animate-pulse flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
          <div className="h-44 rounded-[22px] bg-[#e8e1d8]" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-[18px] bg-white ring-1 ring-[#e8dfd4]" />
            ))}
          </div>
        </div>
        <div className="h-80 rounded-[22px] bg-white ring-1 ring-[#e8dfd4]" />
      </div>
    </div>
  );
}
