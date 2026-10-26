"use client";

import { useState } from "react";
import type { MonitorAccount, MonitorCliente } from "@/features/ops/types/prepago-monitor";

type Result = {
  advertiserId: string;
  ok: boolean;
  removedUsd: number;
  leftUsd: number | null;
  pausedCampaigns?: number;
  message: string;
};
type Action = "bajar" | "cero" | "congelar";

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const usd = (v: number | null | undefined) => usdFmt.format(Number(v) || 0);

/**
 * Gerencia le quita saldo a un cliente o lo congela (no puede gastar más).
 * Ver app/api/ops/frenar-gasto/route.ts.
 */
export function FrenarGasto({ cliente, onDone }: { cliente: MonitorCliente; onDone: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nameOf = new Map(cliente.accounts.map((a) => [a.advertiserId, a.name]));
  const accounts = [...cliente.accounts].sort(
    (a, b) => Number(a.status === "banned") - Number(b.status === "banned") || spendable(b) - spendable(a),
  );
  const total = cliente.accounts.reduce((s, a) => s + (a.status === "banned" ? 0 : spendable(a)), 0);

  async function run(action: Action, account?: MonitorAccount) {
    setError(null);
    if (motivo.trim().length < 3) {
      setError("Primero escribe el motivo y quién lo ordenó.");
      return;
    }
    const amount = account ? Number(amounts[account.advertiserId]) : NaN;
    if (action === "bajar" && !(amount > 0)) {
      setError("Escribe cuánto quieres bajar.");
      return;
    }
    const question =
      action === "congelar"
        ? `¿Congelar a ${cliente.name}? Se pausan sus campañas y sus ${cliente.accounts.length} cuenta(s) quedan en $0 para gastar.`
        : action === "cero"
          ? `¿Dejar ${account!.name} en $0 para gastar?`
          : `¿Bajar ${usd(amount)} a ${account!.name}?`;
    if (!window.confirm(question)) return;

    setBusy(account ? `${action}:${account.advertiserId}` : action);
    setResults(null);
    try {
      const res = await fetch("/api/ops/frenar-gasto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: cliente.id,
          action,
          advertiserId: account?.advertiserId,
          amountUsd: action === "bajar" ? amount : undefined,
          motivo: motivo.trim(),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { results?: Result[]; error?: string };
      if (!res.ok && !j.results) throw new Error(j.error || "No se pudo aplicar.");
      setResults(j.results ?? []);
      if (account) setAmounts((prev) => ({ ...prev, [account.advertiserId]: "" }));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-[#f5c6bf]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9f1d12]">Frenar gasto</p>
          <p className="mt-1 max-w-xl text-[12.5px] leading-5 text-[#6b645c]">
            Quita saldo de sus cuentas en TikTok. En BM 10/30 baja el cupo; en BM 200/300 devuelve el cash al BM.
            Lo que pagó sigue a su favor en Hecom.
          </p>
        </div>
        <p className="shrink-0 text-right text-[11px] text-[#a39b92]">
          Hoy puede gastar
          <span className="block text-[15px] font-semibold tabular-nums text-[#1a1714]">
            {cliente.unlimitedAccounts ? "Sin tope" : usd(total)}
          </span>
        </p>
      </div>

      <label className="mt-3 block">
        <span className="text-[11.5px] font-medium text-[#6b645c]">Motivo y quién lo ordenó (obligatorio)</span>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={300}
          placeholder="Ej: Debe setiembre, ordenó gerencia"
          className="mt-1 w-full rounded-xl border border-[#ece7e0] bg-[#faf8f5] px-3 py-2 text-[12.5px] text-[#1a1714] outline-none transition placeholder:text-[#a39b92] focus:border-[#d47840] focus:bg-white"
        />
      </label>

      <ul className="mt-3 divide-y divide-[#f3eee8] rounded-xl ring-1 ring-[#efe8df]">
        {accounts.map((a) => {
          const banned = a.status === "banned";
          const key = a.advertiserId;
          return (
            <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold text-[#1a1714]">
                  <span className="rounded-md bg-[#f5f0ea] px-1.5 py-0.5 text-[10.5px] tabular-nums text-[#5c564e]">BM{a.bm}</span>
                  <span className="truncate">{a.name}</span>
                  {banned ? (
                    <span className="rounded-md bg-[#fdecea] px-1.5 py-0.5 text-[10.5px] text-[#9f1d12]">Castigada</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[11.5px] text-[#6b645c]">
                  Puede gastar{" "}
                  <span className="font-semibold tabular-nums text-[#1a1714]">{a.unlimited ? "sin tope" : usd(a.spendableUsd)}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  inputMode="decimal"
                  aria-label={`Monto a bajar de ${a.name}`}
                  value={amounts[key] ?? ""}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [key]: e.target.value.replace(/[^\d.]/g, "") }))}
                  placeholder="$"
                  className="w-20 rounded-lg border border-[#ece7e0] bg-[#faf8f5] px-2 py-1.5 text-right text-[12.5px] tabular-nums outline-none focus:border-[#d47840] focus:bg-white"
                />
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void run("bajar", a)}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#c2410c] ring-1 ring-[#f3d5c0] hover:bg-[#fff4ec] disabled:opacity-40"
                >
                  {busy === `bajar:${key}` ? "Bajando…" : "Bajar"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void run("cero", a)}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#9f1d12] ring-1 ring-[#f5c6bf] hover:bg-[#fdecea] disabled:opacity-40"
                >
                  {busy === `cero:${key}` ? "Aplicando…" : "Dejar en $0"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-4 text-[#a39b92]">
          Congelar pausa sus campañas y deja todas sus cuentas en $0. Para habilitarlo otra vez, recárgale como siempre.
        </p>
        <button
          type="button"
          disabled={busy !== null || cliente.accounts.length === 0}
          onClick={() => void run("congelar")}
          className="shrink-0 rounded-full bg-[#9f1d12] px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#86180f] disabled:opacity-40"
        >
          {busy === "congelar" ? "Congelando…" : "Congelar: no puede gastar más"}
        </button>
      </div>

      {error ? <p className="mt-2 text-[12px] text-[#9f1d12]">{error}</p> : null}
      {results ? (
        <ul className="mt-3 space-y-1 rounded-xl bg-[#faf8f5] px-3 py-2.5 text-[12px] leading-5">
          {results.map((r) => (
            <li key={r.advertiserId} className={r.ok ? "text-[#276043]" : "text-[#9f1d12]"}>
              <span className="font-semibold">{r.ok ? "✓" : "✗"} {nameOf.get(r.advertiserId) ?? r.advertiserId}</span>
              {r.ok && r.removedUsd > 0 ? ` · quitado ${usd(r.removedUsd)}` : ""}
              {r.ok && r.leftUsd != null ? ` · queda ${usd(r.leftUsd)}` : ""} · {r.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function spendable(a: MonitorAccount): number {
  return Number(a.spendableUsd) || 0;
}
