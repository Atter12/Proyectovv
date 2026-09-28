"use client";

import { useEffect, useMemo, useState } from "react";
import { LinksDeudaCuentas } from "@/features/clientes/components/LinksDeudaCuentas.client";

type DebtLinkClient = {
  id: string;
  name: string;
  url: string;
};

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "C"
  );
}

const LINK_FEATURES = [
  {
    title: "Cuánto debe",
    body: "Saldo del mes con gasto + fee y lo cobrado.",
    icon: "M4 15.5h12M6 12.5V9M10 12.5V5.5M14 12.5V8",
  },
  {
    title: "Pagos y gastos",
    body: "Día a día, historial y comprobantes.",
    icon: "M5 4.5h10v11l-2-1.3-1.5 1.3L10 14.2l-1.5 1.3L7 14.2l-2 1.3zM7.5 8h5M7.5 11h3",
  },
  {
    title: "Paga o reporta",
    body: "Sube voucher o avisa si falta un pago.",
    icon: "M10 13V4.5M6.5 8 10 4.5 13.5 8M4.5 13.5v1A1.5 1.5 0 0 0 6 16h8a1.5 1.5 0 0 0 1.5-1.5v-1",
  },
];

export function LinksDeudaPanel({ clients }: { clients: DebtLinkClient[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const q = fold(query);
    if (!q) return clients;
    return clients.filter((row) => fold(row.name).includes(q));
  }, [clients, query]);

  const selected = clients.find((row) => row.id === selectedId) ?? null;

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const lock = () => {
      const value = desktop.matches ? "hidden" : "";
      root.style.overflow = value;
      body.style.overflow = value;
    };
    lock();
    desktop.addEventListener("change", lock);
    return () => {
      desktop.removeEventListener("change", lock);
      root.style.overflow = "";
      body.style.overflow = "";
    };
  }, []);

  async function copyLink() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid items-start gap-3 lg:h-[calc(100dvh-12.75rem)] lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:items-stretch lg:overflow-hidden">
      <section className="flex h-[min(68dvh,36rem)] flex-col overflow-hidden rounded-[22px] bg-white ring-1 ring-[#e8dfd4] lg:h-full">
        <div className="shrink-0 border-b border-[#efe8df] px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="links-deuda-search"
              className="text-[14px] font-semibold tracking-[-0.01em] text-[#1a1714]"
            >
              Clientes
            </label>
            <span className="rounded-full bg-[#f5f0ea] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#5c564e]">
              {filtered.length} de {clients.length}
            </span>
          </div>
          <div className="relative mt-2.5">
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
              id="links-deuda-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busca por nombre"
              className="h-10 w-full rounded-full border border-[#ece7e0] bg-[#faf8f5] pl-9 pr-4 text-[13px] text-[#1a1714] outline-none transition placeholder:text-[#a39b92] focus:border-[#d47840] focus:bg-white focus-visible:ring-2 focus-visible:ring-[#d47840]/30"
            />
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-1.5">
          {filtered.length === 0 ? (
            <li className="m-2 rounded-2xl bg-[#fcfaf7] px-3.5 py-8 text-center text-[13px] text-[#5c564e]">
              Ningún cliente con ese nombre.
            </li>
          ) : (
            filtered.map((row) => {
              const active = row.id === selectedId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(row.id);
                      setCopied(false);
                    }}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d47840]/40 ${
                      active ? "bg-[#fff6ee] ring-1 ring-[#f3d6bf]" : "hover:bg-[#faf8f5]"
                    }`}
                  >
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        active ? "bg-[#1a1714] text-[#f0b889]" : "bg-[#f7f0e9] text-[#b85f2e]"
                      }`}
                      aria-hidden
                    >
                      {initialsOf(row.name)}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-[14px] leading-5 ${
                        active ? "font-semibold text-[#1a1714]" : "font-medium text-[#3f3a34]"
                      }`}
                    >
                      {row.name}
                    </span>
                    {active ? (
                      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#d47840]" fill="none" aria-hidden>
                        <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="flex flex-col overflow-hidden rounded-[22px] bg-white p-5 ring-1 ring-[#e8dfd4] sm:p-6 lg:sticky lg:top-0 lg:h-full lg:overflow-y-auto">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3.5">
              <span
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1a1714] text-[14px] font-bold text-[#f0b889]"
                aria-hidden
              >
                {initialsOf(selected.name)}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">
                  Link público
                </p>
                <h2 className="truncate text-[1.35rem] font-semibold tracking-[-0.03em] text-[#1a1714]">
                  {selected.name}
                </h2>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[22px] bg-[#1a1714] p-5 text-white">
              <div
                className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-[#d47840]/25 blur-2xl"
                aria-hidden
              />
              <div className="relative">
                <p className="text-[12px] text-white/60">
                  Deuda, gastos y pagos del mes en curso. Puede pagar o subir un
                  comprobante.
                </p>
                <p className="mt-3 break-all rounded-2xl bg-white/[0.06] px-4 py-3 font-mono text-[12px] leading-5 text-white/90 ring-1 ring-white/10">
                  {selected.url}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-[#d47840] px-4 text-[13px] font-semibold text-white transition hover:bg-[#b85f2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0b889]/60"
                  >
                    {copied ? (
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
                        <path d="m5 10.5 3.2 3L15 6.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
                        <rect x="7" y="7" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    )}
                    {copied ? "Copiado" : "Copiar link"}
                  </button>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-[13px] font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0b889]/60"
                  >
                    Abrir
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
                      <path d="M8 5H5.5A1.5 1.5 0 0 0 4 6.5v8A1.5 1.5 0 0 0 5.5 16h8a1.5 1.5 0 0 0 1.5-1.5V12M11 4h5v5M16 4l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[12px] font-medium text-[#5c564e]">Qué ve el cliente</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {LINK_FEATURES.map((item) => (
                  <div key={item.title} className="rounded-2xl bg-[#fcfaf7] px-4 py-3.5 ring-1 ring-[#efe8df]">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#f7f0e9] text-[#b85f2e]"
                      aria-hidden
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                        <path d={item.icon} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <p className="mt-2.5 text-[13px] font-semibold text-[#1a1714]">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#8a8177]">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <LinksDeudaCuentas
              key={selected.id}
              clienteId={selected.id}
              clienteName={selected.name}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-[#fcfaf7] px-6 py-12 text-center ring-1 ring-[#efe8df]">
            <span
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7f0e9] text-[#b85f2e]"
              aria-hidden
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
                <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </span>
            <p className="mt-3 text-[14px] font-semibold text-[#1a1714]">Link público</p>
            <p className="mt-1 max-w-sm text-[13px] leading-5 text-[#5c564e]">
              Elige un cliente para ver su link de deuda.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
