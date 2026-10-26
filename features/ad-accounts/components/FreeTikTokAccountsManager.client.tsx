"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { routes } from "@/config/routes";
import { TikTokRenameStatus } from "./TikTokRenameStatus.client";

type Member = { userId: string; userName: string };
type FreeAccount = { advertiserId: string; name: string; members: Member[] | null };
type BcMember = { userId: string; userName: string; email: string | null; role: string | null };
type ClienteOption = { id: string; name: string };
type TikTokUser = { userId: string; userName: string; accounts: number; suggested: boolean };
type Snapshot = {
  accounts: FreeAccount[];
  members: BcMember[];
  createdToday: number;
  maxPerBatch: number;
  recommendedPerDay: number;
  maxPerClienteAssign: number;
};
type BmSummary = { bm: string; free: number | null; total: number | null; createdToday: number; leftToday: number; capped: boolean };
type GivenToCliente = {
  advertiserId: string;
  advertiserName: string;
  hecomLinked: boolean;
  inPanel: boolean;
  budgetZero: boolean | null;
  access: Array<{ userId: string; ok: boolean; message: string }>;
  renameRequested?: boolean | null;
};

const BMS: Array<{ id: string; label: string; hint: string }> = [
  { id: "300", label: "BM 300", hint: "Cash" },
  { id: "200", label: "BM 200", hint: "Cash" },
  { id: "30", label: "BM 30", hint: "Crédito · nace en $0" },
  { id: "10", label: "BM 10", hint: "Crédito · nace en $0" },
];
const QUICK_COUNTS = [1, 5, 10, 15, 20];

const card = "rounded-2xl border border-[#e8e1d8] bg-white";
const label = "text-[12px] font-semibold text-[#5c564e]";
const input = "h-10 w-full rounded-xl bg-[#faf8f5] px-3 text-[14px] ring-1 ring-[#e8e1d8] focus:outline-none focus:ring-2 focus:ring-[#ff781f]";
const primary =
  "inline-flex h-11 items-center justify-center rounded-xl bg-[#ff781f] px-5 text-[13px] font-semibold text-white transition hover:bg-[#e85a1c] disabled:opacity-50";

/** Mismo prefijo que el servidor (freeNamePrefix), solo para la vista previa. */
function previewPrefix(raw: string): string {
  const clean = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\blibre\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return clean ? `Libre ${clean}` : "Libre";
}

async function readJson<T>(res: Response): Promise<T & { error?: string | null }> {
  const j = (await res.json().catch(() => ({}))) as T & { error?: string | null };
  return j;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#c2410c] hover:bg-[#fff4ec]"
    >
      {done ? "Copiado" : "Copiar"}
    </button>
  );
}

async function fetchSnapshot(bm: string): Promise<Snapshot> {
  const res = await fetch(`${routes.api.adAccountsTikTokFree}?bm=${bm}`, { credentials: "include", cache: "no-store" });
  const j = await readJson<Snapshot>(res);
  if (!res.ok) throw new Error(j.error || "No se pudo leer TikTok.");
  return j;
}

/** Solo gerencia: crear cuentas libres por tanda, verlas y entregarlas. */
export function FreeTikTokAccountsManager() {
  const [bm, setBm] = useState("300");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apply = useCallback((p: Promise<Snapshot>) => {
    p.then(
      (j) => {
        setSnap(j);
        setLoadError(null);
      },
      (e: unknown) => {
        setSnap(null);
        setLoadError(e instanceof Error ? e.message : "No se pudo leer TikTok.");
      },
    ).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apply(fetchSnapshot(bm));
  }, [bm, apply]);

  const [summary, setSummary] = useState<Record<string, BmSummary>>({});
  const loadSummary = useCallback(() => {
    fetch(`${routes.api.adAccountsTikTokFree}?summary=1`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { summary?: BmSummary[] }) => setSummary(Object.fromEntries((j.summary ?? []).map((s) => [s.bm, s]))))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  function reload(bmId: string) {
    setLoading(true);
    apply(fetchSnapshot(bmId));
    loadSummary();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Business Center">
        {BMS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={bm === b.id}
            onClick={() => {
              if (b.id === bm) return;
              setSnap(null);
              setLoading(true);
              setBm(b.id);
            }}
            className={`rounded-xl px-3 py-2 text-left ring-1 transition ${
              bm === b.id ? "bg-[#fff4ec] ring-2 ring-[#ff781f]" : "bg-white ring-[#e8e1d8] hover:ring-[#d6cbbf]"
            }`}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-semibold text-[#1c1917]">{b.label}</span>
              <span className="text-[11px] text-[#8a8278]">{b.hint}</span>
            </span>
            {summary[b.id] ? (
              <>
                <span className="mt-1 block text-[18px] font-semibold leading-6 text-[#1c1917]">
                  {summary[b.id]!.free ?? "—"} <span className="text-[12px] font-medium text-[#6f675f]">libres</span>
                </span>
                <span className="block text-[11px] leading-4 text-[#6f675f]">
                  {summary[b.id]!.total ?? "—"} cuentas en total
                </span>
                <span
                  className={`mt-0.5 block text-[11px] font-semibold leading-4 ${
                    summary[b.id]!.capped ? "text-red-700" : summary[b.id]!.leftToday ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {summary[b.id]!.capped
                    ? "TikTok: llegó al tope, no crea más"
                    : summary[b.id]!.leftToday
                      ? `Puedes crear ${summary[b.id]!.leftToday} hoy`
                      : "Hoy ya llegó a 20, sigue mañana"}
                </span>
              </>
            ) : (
              <span className="mt-1 block text-[11px] leading-4 text-[#8a8278]">Contando…</span>
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <CreatePanel key={`create-${bm}`} bm={bm} snap={snap} onCreated={() => reload(bm)} />
        <FreeListPanel
          key={`list-${bm}`}
          bm={bm}
          snap={snap}
          loading={loading}
          loadError={loadError}
          onReload={() => reload(bm)}
        />
      </div>
    </div>
  );
}

function CreatePanel({ bm, snap, onCreated }: { bm: string; snap: Snapshot | null; onCreated: () => void }) {
  const [nickname, setNickname] = useState("");
  const [count, setCount] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Array<{ advertiserId: string; name: string; budgetZero: boolean | null }> | null>(null);

  const max = snap?.maxPerBatch ?? 20;
  const recommended = snap?.recommendedPerDay ?? 20;
  const today = snap?.createdToday ?? 0;
  const leftToday = Math.max(0, recommended - today);
  const prefix = previewPrefix(nickname);
  const bmLabel = BMS.find((b) => b.id === bm)?.label ?? bm;

  async function create() {
    const over = today + count > recommended;
    const warn = over ? `\n\nOjo: hoy ya se crearon ${today} en ${bmLabel}. Pasar de ${recommended} al día puede hacer que TikTok bloquee el BM.` : "";
    if (!window.confirm(`¿Crear ${count} cuenta(s) libre(s) en ${bmLabel} con el nombre "${prefix} N"?${warn}`)) return;
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const res = await fetch(routes.api.adAccountsTikTokFree, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", bm, count, label: nickname }),
      });
      const j = await readJson<{ created?: Array<{ advertiserId: string; name: string; budgetZero: boolean | null }> }>(res);
      setCreated(j.created ?? []);
      if (j.error) setError(j.error);
      else if (!res.ok) setError("No se pudo crear.");
      if (j.created?.length) onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${card} h-fit space-y-4 p-4 sm:p-5`}>
      <div>
        <h2 className="text-[15px] font-semibold text-[#1c1917]">Crear cuentas libres</h2>
        <p className="mt-0.5 text-[12px] leading-5 text-[#6f675f]">
          Nacen en {bmLabel} sin dueño, listas para asignar.
        </p>
      </div>

      <label className="block">
        <span className={label}>Apodo o para quién (opcional)</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Ej. Freddy, Soporte, Sebas"
          maxLength={40}
          className={`${input} mt-1`}
        />
        <span className="mt-1 block text-[11px] text-[#8a8278]">
          Quedarán como <b className="text-[#1c1917]">{prefix} 1</b>, <b className="text-[#1c1917]">{prefix} 2</b>… (sigue el número que ya haya).
          Al entregarla a un cliente, el sistema le pone el nombre del cliente.
        </span>
      </label>

      <div>
        <span className={label}>Cantidad</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {QUICK_COUNTS.filter((n) => n <= max).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              aria-pressed={count === n}
              className={`h-9 min-w-11 rounded-lg px-3 text-[13px] font-semibold ring-1 transition ${
                count === n ? "bg-[#1c1917] text-white ring-[#1c1917]" : "bg-[#faf8f5] text-[#1c1917] ring-[#e8e1d8] hover:ring-[#d6cbbf]"
              }`}
            >
              {n}
            </button>
          ))}
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            aria-label="Otra cantidad"
            className="h-9 rounded-lg bg-[#faf8f5] px-2 text-[13px] ring-1 ring-[#e8e1d8]"
          >
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 rounded-xl bg-[#faf8f5] px-3 py-2 text-[12px] leading-5 text-[#5c564e] ring-1 ring-[#efe9e2]">
          Recomendado: <b>{recommended} por día</b> por BM. Hoy van <b>{today}</b>
          {leftToday > 0 ? ` · te quedan ${leftToday}.` : " · ya llegaste, mejor sigue mañana."}
        </div>
      </div>

      <button type="button" onClick={() => void create()} disabled={busy || !snap} className={`${primary} w-full`}>
        {busy ? `Creando en TikTok… (puede tardar ~${Math.ceil(count * 3)} s)` : `Crear ${count} cuenta${count > 1 ? "s" : ""}`}
      </button>

      {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">{error}</div> : null}
      {created && created.length ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-950">
          <p className="font-semibold">Listo: {created.length} creada{created.length > 1 ? "s" : ""}</p>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto text-[12px]">
            {created.map((c) => (
              <li key={c.advertiserId}>
                {c.name} · <span className="font-mono">{c.advertiserId}</span>
                {c.budgetZero === false ? " · ✗ revisar cupo $0 en TikTok" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function FreeListPanel({
  bm,
  snap,
  loading,
  loadError,
  onReload,
}: {
  bm: string;
  snap: Snapshot | null;
  loading: boolean;
  loadError: string | null;
  onReload: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<"member" | "cliente">("member");

  const accounts = useMemo(() => snap?.accounts ?? [], [snap]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.advertiserId.includes(q) ||
        a.members?.some((m) => m.userName.toLowerCase().includes(q)),
    );
  }, [accounts, query]);

  const maxPick = target === "cliente" ? snap?.maxPerClienteAssign ?? 5 : snap?.maxPerBatch ?? 20;
  const picked = accounts.filter((a) => selected.has(a.advertiserId));

  function toggle(id: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else if (s.size < maxPick) s.add(id);
      return s;
    });
  }

  function done() {
    setSelected(new Set());
    onReload();
  }

  return (
    <section className={`${card} flex min-w-0 flex-col`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#efe9e2] px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1c1917]">
            Libres listas para asignar{snap ? ` · ${accounts.length}` : ""}
          </h2>
          <p className="text-[12px] text-[#6f675f]">Sin dueño en Hecom. Marca las que vas a entregar.</p>
        </div>
        <button
          type="button"
          onClick={onReload}
          disabled={loading}
          className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[#c2410c] ring-1 ring-[#f3d5c0] hover:bg-[#fff4ec] disabled:opacity-50"
        >
          {loading ? "Leyendo TikTok…" : "Actualizar"}
        </button>
      </div>

      <div className="px-4 pt-3 sm:px-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, ID o miembro"
          aria-label="Buscar cuentas libres"
          className={input}
        />
      </div>

      {loadError ? (
        <p className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950 sm:mx-5">{loadError}</p>
      ) : null}

      <div className="mt-2 max-h-[420px] min-h-[120px] overflow-auto px-2 sm:px-3">
        {loading && !snap ? (
          <p className="px-2 py-6 text-center text-[13px] text-[#6f675f]">Leyendo las cuentas de {BMS.find((b) => b.id === bm)?.label}…</p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-[#6f675f]">
            {accounts.length ? "Nada coincide con la búsqueda." : "No hay cuentas libres en este BM. Crea una tanda a la izquierda."}
          </p>
        ) : (
          <ul className="divide-y divide-[#f2ede7]">
            {visible.map((a) => {
              const on = selected.has(a.advertiserId);
              const full = !on && selected.size >= maxPick;
              return (
                <li key={a.advertiserId}>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 ${on ? "bg-[#fff4ec]" : "hover:bg-[#faf8f5]"} ${full ? "opacity-50" : ""}`}>
                    <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(a.advertiserId)} className="mt-1" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[#1c1917]">{a.name}</span>
                      <span className="block font-mono text-[11px] text-[#8a8278]">{a.advertiserId}</span>
                      <span className="block text-[11px] text-[#6f675f]">
                        {a.members === null
                          ? "Acceso: no se pudo leer"
                          : a.members.length
                            ? `Acceso: ${a.members.map((m) => m.userName).join(", ")}`
                            : "Sin miembros asignados"}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-auto border-t border-[#efe9e2] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-[#1c1917]">
            {picked.length ? `${picked.length} marcada${picked.length > 1 ? "s" : ""}` : "Marca cuentas para asignar"}
          </span>
          <div className="ml-auto inline-flex rounded-xl bg-[#faf8f5] p-1 ring-1 ring-[#e8e1d8]" role="tablist">
            {([
              ["member", "A un miembro"],
              ["cliente", "A un cliente"],
            ] as const).map(([id, text]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={target === id}
                onClick={() => {
                  setTarget(id);
                  if (id === "cliente" && selected.size > (snap?.maxPerClienteAssign ?? 5)) setSelected(new Set());
                }}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                  target === id ? "bg-white text-[#1c1917] shadow-sm ring-1 ring-[#e8e1d8]" : "text-[#6f675f] hover:text-[#1c1917]"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          {target === "member" ? (
            <AssignToMember bm={bm} members={snap?.members ?? []} picked={picked} onDone={done} />
          ) : (
            <AssignToCliente bm={bm} picked={picked} max={snap?.maxPerClienteAssign ?? 5} onDone={done} />
          )}
        </div>
      </div>
    </section>
  );
}

function AssignToMember({ bm, members, picked, onDone }: { bm: string; members: BcMember[]; picked: FreeAccount[]; onDone: () => void }) {
  const [userId, setUserId] = useState("");
  const [manualId, setManualId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const member: BcMember | undefined = manualId.length >= 6
    ? { userId: manualId, userName: `ID ${manualId}`, email: null, role: null }
    : members.find((m) => m.userId === userId);

  async function assign() {
    if (!member) return;
    if (!window.confirm(`¿Dar a ${member.userName} acceso de administrador a ${picked.length} cuenta(s)? Siguen libres (sin cliente).`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(routes.api.adAccountsTikTokFree, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "member", bm, userId: member.userId, advertiserIds: picked.map((p) => p.advertiserId) }),
      });
      const j = await readJson<{ results?: Array<{ advertiserId: string; ok: boolean; message: string }> }>(res);
      if (!res.ok) throw new Error(j.error || "No se pudo asignar.");
      const results = j.results ?? [];
      const bad = results.filter((r) => !r.ok);
      setMsg({
        ok: bad.length === 0,
        text: bad.length
          ? `${results.length - bad.length} de ${results.length} OK. Fallaron: ${bad.map((b) => `${b.advertiserId} (${b.message})`).join("; ")}`
          : `Listo: ${member.userName} ya tiene acceso a ${results.length} cuenta(s).`,
      });
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo asignar." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Miembro del BC" className={`${input} sm:flex-1`}>
          <option value="">{members.length ? "Elige un miembro del equipo" : "Aún no hay miembros en las libres"}</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.userName}
              {m.email ? ` · ${m.email}` : ""}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void assign()} disabled={busy || !member || !picked.length} className={primary}>
          {busy ? "Asignando…" : "Dar acceso"}
        </button>
      </div>
      <input
        value={manualId}
        onChange={(e) => setManualId(e.target.value.replace(/\D/g, ""))}
        placeholder="¿Miembro nuevo? Pega su user ID de TikTok (BC → Usuarios)"
        aria-label="User ID de TikTok del miembro"
        inputMode="numeric"
        className={input}
      />
      <p className="text-[11px] text-[#8a8278]">Administrador solo de esas cuentas, nunca del BM.</p>
      {msg ? (
        <p className={`rounded-xl px-3 py-2 text-[13px] ${msg.ok ? "border border-emerald-200 bg-emerald-50 text-emerald-950" : "border border-amber-200 bg-amber-50 text-amber-950"}`}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}

function AssignToCliente({ bm, picked, max, onDone }: { bm: string; picked: FreeAccount[]; max: number; onDone: () => void }) {
  const [clientes, setClientes] = useState<ClienteOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [cliente, setCliente] = useState<ClienteOption | null>(null);
  const [users, setUsers] = useState<TikTokUser[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [manualUser, setManualUser] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [given, setGiven] = useState<GivenToCliente[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/clientes", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { clients?: ClienteOption[] }) => {
        if (alive) setClientes((j.clients ?? []).map((c) => ({ id: c.id, name: c.name })));
      })
      .catch(() => alive && setClientes([]));
    return () => {
      alive = false;
    };
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !clientes) return [];
    return clientes.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [clientes, query]);

  async function pickCliente(c: ClienteOption) {
    setCliente(c);
    setQuery(c.name);
    setUsers(null);
    setGiven(null);
    setError(null);
    try {
      const res = await fetch(`${routes.api.adAccountsTikTokFree}?clienteId=${encodeURIComponent(c.id)}`, { credentials: "include", cache: "no-store" });
      const j = await readJson<{ users?: TikTokUser[] }>(res);
      const list = j.users ?? [];
      setUsers(list);
      setChecked(new Set(list.filter((u) => u.suggested).map((u) => u.userId)));
    } catch {
      setUsers([]);
    }
  }

  async function assign() {
    if (!cliente) return;
    const accessUserIds = [...checked];
    if (manualUser.trim()) accessUserIds.push(manualUser.trim());
    const who = accessUserIds.length ? `y dar acceso a ${accessUserIds.length} usuario(s) suyo(s)` : "SIN dar acceso a nadie en TikTok";
    if (!window.confirm(`¿Entregar ${picked.length} cuenta(s) a ${cliente.name} ${who}?`)) return;
    setBusy(true);
    setError(null);
    setGiven(null);
    try {
      const res = await fetch(routes.api.adAccountsTikTokFree, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cliente", bm, clienteId: cliente.id, accessUserIds, advertiserIds: picked.map((p) => p.advertiserId) }),
      });
      const j = await readJson<{ created?: GivenToCliente[] }>(res);
      setGiven(j.created ?? []);
      if (j.error) setError(j.error);
      else if (!res.ok) setError("No se pudo entregar.");
      if (j.created?.length) onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo entregar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCliente(null);
          }}
          placeholder={clientes ? "Busca el cliente por nombre" : "Cargando clientes…"}
          aria-label="Cliente"
          className={input}
        />
        {!cliente && matches.length ? (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-[#e8e1d8]">
            {matches.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => void pickCliente(c)} className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#fff4ec]">
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {cliente ? (
        <div>
          <p className={label}>Darle acceso en TikTok (administrador solo de la cuenta)</p>
          {users === null ? (
            <p className="mt-1 text-[12px] text-[#6f675f]">Buscando sus usuarios de TikTok…</p>
          ) : users.length ? (
            <ul className="mt-1 space-y-1">
              {users.map((u) => (
                <li key={u.userId}>
                  <label className="flex items-center gap-2 text-[13px] text-[#1c1917]">
                    <input
                      type="checkbox"
                      checked={checked.has(u.userId)}
                      onChange={() =>
                        setChecked((prev) => {
                          const s = new Set(prev);
                          if (s.has(u.userId)) s.delete(u.userId);
                          else s.add(u.userId);
                          return s;
                        })
                      }
                    />
                    <span className="font-medium">{u.userName}</span>
                    <span className="text-[11px] text-[#8a8278]">
                      en {u.accounts} cuenta(s){u.suggested ? " · cliente" : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[12px] text-[#6f675f]">No encontré usuarios en sus cuentas actuales.</p>
          )}
          <input
            value={manualUser}
            onChange={(e) => setManualUser(e.target.value.replace(/\D/g, ""))}
            placeholder="Otro user ID de TikTok (opcional)"
            aria-label="Otro user ID de TikTok"
            inputMode="numeric"
            className={`${input} mt-2 max-w-xs`}
          />
          <p className="mt-1 text-[11px] text-[#8a8278]">Desmarca al equipo: ellos ya ven todo por el BM.</p>
        </div>
      ) : null}

      <button type="button" onClick={() => void assign()} disabled={busy || !cliente || !picked.length} className={primary}>
        {busy ? "Entregando…" : `Entregar ${picked.length || ""} a ${cliente?.name ?? "cliente"}`.replace("  ", " ")}
      </button>
      <p className="text-[11px] text-[#8a8278]">
        Hasta {max} por vez. Queda en su ficha de Hecom y en su panel al instante (BM 10/30 con cupo $0).
      </p>

      {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">{error}</p> : null}
      {given && given.length ? (
        <div className="space-y-2">
          <TikTokRenameStatus accounts={given} />
          <ul className="space-y-2">
            {given.map((c) => (
              <li key={c.advertiserId} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-950">
                <p className="flex flex-wrap items-center gap-1 font-semibold">
                  {c.advertiserName} <CopyButton text={c.advertiserName} />
                </p>
                <p className="font-mono text-[12px]">{c.advertiserId}</p>
                <p className="text-[12px]">
                  Hecom {c.hecomLinked ? "✓" : "✗ (vincular a mano)"} · Panel {c.inPanel ? "✓" : "pendiente"}
                  {c.budgetZero === null ? "" : ` · Cupo $0 ${c.budgetZero ? "✓" : "✗"}`}
                  {c.access.length ? ` · Acceso ${c.access.filter((a) => a.ok).length}/${c.access.length}` : " · Sin acceso a cliente"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
