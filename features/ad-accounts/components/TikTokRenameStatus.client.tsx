"use client";

import { useState } from "react";
import { routes } from "@/config/routes";

type Row = { advertiserId: string; advertiserName: string; renameRequested?: boolean | null };
type State = "pending" | "applied" | "notyet" | "failed" | "busy";

/**
 * Estado del nombre en TikTok tras entregar cuentas libres a un cliente.
 * El renombre por API tarda minutos; aquí se verifica el nombre vivo y se reintenta
 * sin salir del panel. Si TikTok no lo aplica, queda el botón para copiar el nombre.
 */
export function TikTokRenameStatus({ accounts }: { accounts: Row[] }) {
  const rows = accounts.filter((a) => a.renameRequested !== null && a.renameRequested !== undefined);
  const [state, setState] = useState<Record<string, State>>(() =>
    Object.fromEntries(rows.map((a) => [a.advertiserId, a.renameRequested ? "pending" : "failed"])),
  );
  const [live, setLive] = useState<Record<string, string | null>>({});
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!rows.length) return null;

  async function verify() {
    setChecking(true);
    setNote(null);
    try {
      const res = await fetch(`${routes.api.adAccountsTikTokFree}?names=${rows.map((r) => r.advertiserId).join(",")}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as { names?: Record<string, string | null>; error?: string };
      if (!res.ok || !j.names) throw new Error(j.error || "No se pudo leer TikTok.");
      setLive(j.names);
      setState((prev) => {
        const next = { ...prev };
        for (const r of rows) {
          const name = j.names![r.advertiserId];
          if (name === r.advertiserName) next[r.advertiserId] = "applied";
          else if (next[r.advertiserId] !== "failed") next[r.advertiserId] = "notyet";
        }
        return next;
      });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "No se pudo leer TikTok.");
    } finally {
      setChecking(false);
    }
  }

  async function retry(r: Row) {
    setState((prev) => ({ ...prev, [r.advertiserId]: "busy" }));
    try {
      const res = await fetch(routes.api.adAccountsTikTokFree, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", advertiserId: r.advertiserId, name: r.advertiserName }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      setState((prev) => ({ ...prev, [r.advertiserId]: j.ok ? "pending" : "failed" }));
      if (!j.ok) setNote(j.message || j.error || "TikTok rechazó el nombre.");
    } catch {
      setState((prev) => ({ ...prev, [r.advertiserId]: "failed" }));
    }
  }

  const allApplied = rows.every((r) => state[r.advertiserId] === "applied");

  return (
    <div className="space-y-2 rounded-xl bg-[#fff8eb] px-3 py-2.5 text-[12px] leading-5 text-[#7a4b12] ring-1 ring-[#f5dfb8]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {allApplied ? "Nombres actualizados en TikTok ✓" : "Nombre en TikTok: ya se pidió el cambio, tarda unos minutos en verse."}
        </p>
        {allApplied ? null : (
          <button
            type="button"
            onClick={() => void verify()}
            disabled={checking}
            className="rounded-lg bg-white px-3 py-1 text-[12px] font-semibold text-[#c2410c] ring-1 ring-[#f3d5c0] hover:bg-[#fff4ec] disabled:opacity-50"
          >
            {checking ? "Leyendo TikTok…" : "Verificar nombre"}
          </button>
        )}
      </div>
      <ul className="space-y-1">
        {rows.map((r) => {
          const s = state[r.advertiserId];
          return (
            <li key={r.advertiserId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[11px]">{r.advertiserId}</span>
              <span>
                {s === "applied"
                  ? "✓ ya se llama así"
                  : s === "busy"
                    ? "Pidiendo…"
                    : s === "failed"
                      ? "✗ TikTok no lo aceptó"
                      : s === "notyet"
                        ? `Aún se llama "${live[r.advertiserId] ?? "?"}"`
                        : "Pedido"}
              </span>
              {s === "notyet" || s === "failed" ? (
                <button
                  type="button"
                  onClick={() => void retry(r)}
                  className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#c2410c] hover:bg-[#fff4ec]"
                >
                  Reintentar
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {note ? <p className="text-amber-900">{note}</p> : null}
      {allApplied ? null : (
        <p className="text-[11px] text-[#8a6a3c]">
          En cuentas recién creadas TikTok a veces no lo aplica. Si tras reintentar sigue igual, cámbialo en el BC con el botón Copiar.
        </p>
      )}
    </div>
  );
}
