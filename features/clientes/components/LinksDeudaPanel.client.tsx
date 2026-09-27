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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#e8dfd4]">
        <div className="border-b border-[#efe8df] px-4 py-4">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">
            Clientes
          </label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca por nombre"
            className="mt-2 h-10 w-full rounded-[10px] border border-[#ece7e0] bg-[#faf8f5] px-3 text-[13px] text-[#1a1714] outline-none placeholder:text-[#a39b92] focus:border-[#d47840] focus:bg-white"
          />
          <p className="mt-2 text-[12px] text-[#6b645c]">
            {filtered.length} de {clients.length}
          </p>
        </div>
        <ul className="max-h-[28rem] overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-[13px] text-[#6b645c]">
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
                        ? "flex w-full items-center px-4 py-3 text-left text-[13px] font-semibold text-[#1a1714] bg-[#fff8f1]"
                        : "flex w-full items-center px-4 py-3 text-left text-[13px] font-medium text-[#3f3a34] hover:bg-[#faf8f5]"
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

      <section className="rounded-2xl border border-[#ffd7b8] bg-gradient-to-br from-[#fff8f1] via-white to-[#f7f4ef] p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">
          Link público
        </p>
        {selected ? (
          <>
            <h2 className="mt-1 text-[1.15rem] font-semibold tracking-[-0.02em] text-[#1a1714]">
              {selected.name}
            </h2>
            <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-[#5c564e]">
              El cliente ve su deuda, gastos y pagos del mes en curso. Desde ahí
              puede pagar o subir un comprobante.
            </p>
            <p className="mt-4 break-all rounded-xl border border-[#f0e6dc] bg-white px-3 py-3 font-mono text-[12px] leading-5 text-[#1a1714]">
              {selected.url}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex h-10 items-center rounded-[10px] bg-[#c2410c] px-4 text-[13px] font-semibold text-white hover:bg-[#9a3412]"
              >
                {copied ? "Copiado" : "Copiar link"}
              </button>
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center rounded-[10px] border border-[#e7d3c4] bg-white px-4 text-[13px] font-semibold text-[#1a1714] hover:border-[#d47840]"
              >
                Abrir
              </a>
            </div>
          </>
        ) : (
          <p className="mt-2 max-w-md text-[13px] leading-5 text-[#5c564e]">
            Elige un cliente para ver su link de deuda.
          </p>
        )}
      </section>
    </div>
  );
}
