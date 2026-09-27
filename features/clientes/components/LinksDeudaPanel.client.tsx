"use client";

import { useMemo, useState } from "react";

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
    <div className="grid h-full min-h-0 flex-1 items-stretch gap-3 overflow-hidden lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-[#e8dfd4]">
        <div className="shrink-0 border-b border-[#efe8df] px-3.5 py-3">
          <label
            htmlFor="links-deuda-search"
            className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]"
          >
            Clientes
          </label>
          <input
            id="links-deuda-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca por nombre"
            className="mt-2 h-9 w-full rounded-lg border border-[#ece7e0] bg-[#faf8f5] px-3 text-[13px] text-[#1a1714] outline-none placeholder:text-[#a39b92] focus:border-[#d47840] focus:bg-white focus-visible:ring-2 focus-visible:ring-[#d47840]/30"
          />
          <p className="mt-1.5 text-[11px] text-[#8a8177]">
            {filtered.length} de {clients.length}
          </p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {filtered.length === 0 ? (
            <li className="px-3.5 py-8 text-center text-[13px] text-[#6b645c]">
              Ningún cliente con ese nombre.
            </li>
          ) : (
            filtered.map((row) => {
              const active = row.id === selectedId;
              return (
                <li key={row.id} className="border-b border-[#f3eee8] last:border-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(row.id);
                      setCopied(false);
                    }}
                    className={
                      active
                        ? "flex w-full items-center border-l-2 border-[#c2410c] bg-[#fff8f1] px-3.5 py-2 text-left text-[13px] font-semibold text-[#1a1714]"
                        : "flex w-full items-center border-l-2 border-transparent px-3.5 py-2 text-left text-[13px] text-[#3f3a34] hover:bg-[#faf8f5]"
                    }
                  >
                    {row.name}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="h-full min-h-0 overflow-hidden rounded-2xl border border-[#ffd7b8] bg-gradient-to-br from-[#fff8f1] via-white to-[#f7f4ef] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">
          Link público
        </p>
        {selected ? (
          <div className="mt-2">
            <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-[#1a1714]">
              {selected.name}
            </h2>
            <p className="mt-1 max-w-lg text-[13px] leading-5 text-[#6b645c]">
              Deuda, gastos y pagos del mes en curso. Puede pagar o subir un
              comprobante.
            </p>
            <p className="mt-4 break-all rounded-xl border border-[#f0e6dc] bg-white px-3.5 py-3 font-mono text-[12px] leading-5 text-[#1a1714]">
              {selected.url}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex h-9 items-center rounded-lg bg-[#c2410c] px-3.5 text-[13px] font-semibold text-white hover:bg-[#9a3412] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c]/40"
              >
                {copied ? "Copiado" : "Copiar link"}
              </button>
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center rounded-lg border border-[#e7d3c4] bg-white px-3.5 text-[13px] font-semibold text-[#1a1714] hover:border-[#d47840] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d47840]/40"
              >
                Abrir
              </a>
            </div>
          </div>
        ) : (
          <p className="mt-3 max-w-sm text-[13px] leading-5 text-[#6b645c]">
            Elige un cliente para ver su link de deuda.
          </p>
        )}
      </section>
    </div>
  );
}
