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
    <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(18rem,28rem)_minmax(0,1fr)] lg:min-h-[calc(100dvh-13.5rem)]">
      <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-[#e8dfd4] lg:min-h-0">
        <div className="border-b border-[#efe8df] px-5 py-5">
          <label
            htmlFor="links-deuda-search"
            className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]"
          >
            Clientes
          </label>
          <input
            id="links-deuda-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca por nombre"
            className="mt-3 h-12 w-full rounded-xl border border-[#ece7e0] bg-[#faf8f5] px-4 text-[15px] text-[#1a1714] outline-none placeholder:text-[#a39b92] focus:border-[#d47840] focus:bg-white focus-visible:ring-2 focus-visible:ring-[#d47840]/30"
          />
          <p className="mt-2.5 text-[13px] text-[#6b645c]">
            {filtered.length} de {clients.length}
          </p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-5 py-12 text-center text-[15px] text-[#6b645c]">
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
                        ? "flex w-full items-center border-l-[3px] border-[#c2410c] bg-[#fff8f1] px-5 py-4 text-left text-[16px] font-semibold text-[#1a1714]"
                        : "flex w-full items-center border-l-[3px] border-transparent px-5 py-4 text-left text-[16px] font-medium text-[#3f3a34] hover:bg-[#faf8f5]"
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

      <section className="flex min-h-[22rem] flex-col rounded-2xl border border-[#ffd7b8] bg-gradient-to-br from-[#fff8f1] via-white to-[#f7f4ef] p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">
          Link público
        </p>
        {selected ? (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-[#1a1714] sm:text-[2rem]">
              {selected.name}
            </h2>
            <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#5c564e]">
              El cliente ve su deuda, gastos y pagos del mes en curso. Desde ahí
              puede pagar o subir un comprobante.
            </p>
            <p className="mt-6 break-all rounded-2xl border border-[#f0e6dc] bg-white px-5 py-5 font-mono text-[14px] leading-7 text-[#1a1714] sm:text-[15px]">
              {selected.url}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex h-12 items-center rounded-xl bg-[#c2410c] px-6 text-[15px] font-semibold text-white hover:bg-[#9a3412] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c]/40"
              >
                {copied ? "Copiado" : "Copiar link"}
              </button>
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center rounded-xl border border-[#e7d3c4] bg-white px-6 text-[15px] font-semibold text-[#1a1714] hover:border-[#d47840] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d47840]/40"
              >
                Abrir
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center">
            <p className="max-w-md text-[18px] leading-7 text-[#5c564e]">
              Elige un cliente para ver su link de deuda.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
