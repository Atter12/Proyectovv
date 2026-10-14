"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";

type TikTokUser = { userId: string; userName: string; accounts: number; suggested: boolean };
type Created = {
  advertiserId: string;
  advertiserName: string;
  bmBucket: string;
  hecomLinked: boolean;
  inPanel: boolean;
  budgetZero: boolean | null;
  access: Array<{ userId: string; ok: boolean; message: string }>;
};

const BMS: Array<{ id: string; label: string; hint: string }> = [
  { id: "300", label: "BM 300", hint: "Cash · se recarga por transferencia" },
  { id: "200", label: "BM 200", hint: "Cash · se recarga por transferencia" },
  { id: "30", label: "BM 30", hint: "Crédito compartido · nace con cupo $0" },
  { id: "10", label: "BM 10", hint: "Crédito compartido · nace con cupo $0" },
];

/** Solo gerencia: crear cuentas TikTok para el cliente seleccionado en cualquier BM. */
export function StaffCreateTikTokAccountsPanel({ clienteName }: { clienteName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bm, setBm] = useState("300");
  const [count, setCount] = useState(1);
  const [users, setUsers] = useState<TikTokUser[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [manualUser, setManualUser] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created[] | null>(null);
  // "free": entrega cuentas de reserva ("gian libre 151"…) que ya existen en el BM.
  const [mode, setMode] = useState<"create" | "free">("create");
  const [freeByBm, setFreeByBm] = useState<Record<string, number | null>>({});
  const freeHere = freeByBm[bm] ?? null;

  async function loadUsers() {
    setLoadingUsers(true);
    setError(null);
    try {
      const res = await fetch(routes.api.adAccountsTikTokStaffCreate, { credentials: "include", cache: "no-store" });
      const j = (await res.json()) as { users?: TikTokUser[]; freeByBm?: Record<string, number | null>; error?: string };
      if (!res.ok) throw new Error(j.error || "No se pudo leer los usuarios de TikTok.");
      setFreeByBm(j.freeByBm ?? {});
      const list = j.users ?? [];
      setUsers(list);
      setChecked(new Set(list.filter((u) => u.suggested).map((u) => u.userId)));
    } catch (e) {
      setUsers([]);
      setError(e instanceof Error ? e.message : "No se pudo leer los usuarios de TikTok.");
    } finally {
      setLoadingUsers(false);
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && users === null) void loadUsers();
  }

  function toggleUser(id: string) {
    setChecked((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function create() {
    const accessUserIds = [...checked];
    const manual = manualUser.trim();
    if (manual) accessUserIds.push(manual);
    const bmLabel = BMS.find((b) => b.id === bm)?.label ?? bm;
    const who = accessUserIds.length ? `y dar acceso a ${accessUserIds.length} usuario(s)` : "SIN dar acceso a nadie";
    const verb = mode === "free" ? "Dar" : "Crear";
    const kind = mode === "free" ? "cuenta(s) libre(s)" : "cuenta(s)";
    if (!window.confirm(`¿${verb} ${count} ${kind} en ${bmLabel} para ${clienteName} ${who}?`)) return;
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const res = await fetch(routes.api.adAccountsTikTokStaffCreate, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bmBucket: bm, count, accessUserIds, mode }),
      });
      const j = (await res.json()) as { created?: Created[]; error?: string | null };
      setCreated(j.created ?? []);
      if (j.error) setError(j.error);
      else if (!res.ok) setError("No se pudo crear.");
      if (j.created?.length) {
        router.refresh();
        if (mode === "free") setFreeByBm((prev) => ({ ...prev, [bm]: Math.max(0, (prev[bm] ?? 0) - (j.created?.length ?? 0)) }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#e8e1d8] bg-white">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
        aria-expanded={open}
      >
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">Solo gerencia</span>
          <span className="block text-[15px] font-semibold text-[#1c1917]">Crear o dar cuentas TikTok a {clienteName}</span>
        </span>
        <span className="text-[13px] font-semibold text-[#c2410c]">{open ? "Cerrar" : "Abrir"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[#efe9e2] px-4 py-4 sm:px-5">
          <p className="text-[12px] leading-5 text-[#6f675f]">
            Sin límite de cupo. La cuenta queda vinculada a su ficha de Hecom y en su panel al instante, con el nombre
            correlativo del BM (ej. 303.0 USD - Agencia).
          </p>

          <div className="inline-flex rounded-xl bg-[#faf8f5] p-1 ring-1 ring-[#e8e1d8]" role="tablist">
            {([
              ["create", "Crear nuevas"],
              ["free", "Dar cuentas libres"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
                  mode === id ? "bg-white text-[#1c1917] shadow-sm ring-1 ring-[#e8e1d8]" : "text-[#6f675f] hover:text-[#1c1917]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "free" ? (
            <p className="text-[12px] leading-5 text-[#6f675f]">
              Usa cuentas de reserva que ya existen ("gian libre 151", "libre sebas 12"…): se dejan con cupo /usr/bin/bash, quedan a nombre del
              cliente en Hecom y en su panel, y le da acceso a sus usuarios. TikTok no deja cambiar el nombre por API: renómbrala en el BC.
            </p>
          ) : null}

          <div>
            <p className="text-[12px] font-semibold text-[#5c564e]">Business Center</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BMS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBm(b.id)}
                  className={`rounded-xl px-3 py-2 text-left ring-1 transition ${
                    bm === b.id ? "bg-[#fff4ec] ring-2 ring-[#ff781f]" : "bg-[#faf8f5] ring-[#e8e1d8] hover:ring-[#d6cbbf]"
                  }`}
                >
                  <span className="block text-[13px] font-semibold text-[#1c1917]">{b.label}</span>
                  <span className="block text-[11px] leading-4 text-[#6f675f]">
                    {mode === "free"
                      ? freeByBm[b.id] == null
                        ? "Contando libres…"
                        : `${freeByBm[b.id]} libre${freeByBm[b.id] === 1 ? "" : "s"}`
                      : b.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-[12px] font-semibold text-[#5c564e]">Cantidad</span>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-1 block h-10 w-28 rounded-xl bg-[#faf8f5] px-3 text-[14px] ring-1 ring-[#e8e1d8]"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-[12px] font-semibold text-[#5c564e]">Dar acceso en TikTok (administrador solo de la cuenta, nunca del BM)</p>
            {loadingUsers ? (
              <p className="mt-2 text-[12px] text-[#6f675f]">Buscando sus usuarios de TikTok…</p>
            ) : users && users.length ? (
              <ul className="mt-2 space-y-1.5">
                {users.map((u) => (
                  <li key={u.userId}>
                    <label className="flex items-center gap-2 text-[13px] text-[#1c1917]">
                      <input type="checkbox" checked={checked.has(u.userId)} onChange={() => toggleUser(u.userId)} />
                      <span className="font-medium">{u.userName}</span>
                      <span className="text-[11px] text-[#8a8278]">
                        {u.userId} · en {u.accounts} cuenta(s){u.suggested ? " · cliente" : ""}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] text-[#6f675f]">No encontré usuarios en sus cuentas actuales.</p>
            )}
            <input
              value={manualUser}
              onChange={(e) => setManualUser(e.target.value.replace(/\D/g, ""))}
              placeholder="Otro user ID de TikTok (opcional)"
              inputMode="numeric"
              className="mt-2 h-10 w-full max-w-xs rounded-xl bg-[#faf8f5] px-3 text-[13px] ring-1 ring-[#e8e1d8]"
            />
            <p className="mt-1 text-[11px] text-[#8a8278]">Desmarca al equipo (Sebas, Atter, etc.): ellos ya ven todo por el BM.</p>
          </div>

          <button
            type="button"
            onClick={() => void create()}
            disabled={busy || (mode === "free" && (freeHere ?? 0) < count)}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#ff781f] px-5 text-[13px] font-semibold text-white transition hover:bg-[#e85a1c] disabled:opacity-50"
          >
            {busy
              ? mode === "free" ? "Entregando…" : "Creando en TikTok…"
              : mode === "free"
                ? (freeHere ?? 0) < count
                  ? `No hay ${count} libre${count > 1 ? "s" : ""} en este BM`
                  : `Dar ${count} cuenta${count > 1 ? "s" : ""} libre${count > 1 ? "s" : ""}`
                : `Crear ${count} cuenta${count > 1 ? "s" : ""}`}
          </button>

          {error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">{error}</div>
          ) : null}

          {created && created.length ? (
            <ul className="space-y-2">
              {created.map((c) => (
                <li key={c.advertiserId} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-950">
                  <p className="font-semibold">{c.advertiserName}</p>
                  <p className="font-mono text-[12px]">{c.advertiserId}</p>
                  <p className="mt-1 text-[12px]">
                    Hecom {c.hecomLinked ? "✓" : "✗ (vincular a mano)"} · Panel {c.inPanel ? "✓" : "pendiente"}
                    {c.budgetZero === null ? "" : ` · Cupo $0 ${c.budgetZero ? "✓" : "✗ revisar en TikTok"}`}
                    {c.access.length
                      ? ` · Acceso ${c.access.filter((a) => a.ok).length}/${c.access.length}`
                      : " · Sin acceso a cliente"}
                  </p>
                  {c.access.filter((a) => !a.ok).map((a) => (
                    <p key={a.userId} className="text-[12px] text-amber-900">
                      Acceso {a.userId}: {a.message}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
