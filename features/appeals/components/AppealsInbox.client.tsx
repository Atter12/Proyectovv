"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppealRecord, AppealStatus } from "@/lib/appeals/account-appeals.shared";

type StaffAppeal = AppealRecord & { attachmentUrls: Record<string, string> };

const STATUS_UI: Record<AppealStatus, { label: string; chip: string }> = {
  pending: { label: "Por enviar", chip: "bg-amber-100 text-amber-950 ring-amber-200" },
  sent: { label: "Enviada a TikTok", chip: "bg-[#ecfdf3] text-[#067647] ring-[#abefc6]" },
  approved: { label: "Aprobada", chip: "bg-[#d1fadf] text-[#05603a] ring-[#6ce9a6]" },
  rejected: { label: "Rechazada", chip: "bg-[#fef3f2] text-[#b42318] ring-[#fecdca]" },
};

const FILTERS: Array<{ key: "open" | AppealStatus | "all"; label: string }> = [
  { key: "open", label: "Abiertas" },
  { key: "pending", label: "Por enviar" },
  { key: "sent", label: "Enviadas" },
  { key: "approved", label: "Aprobadas" },
  { key: "rejected", label: "Rechazadas" },
  { key: "all", label: "Todas" },
];

function fmtDate(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard.writeText(value).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        })
      }
      className="inline-flex h-8 shrink-0 items-center rounded-lg border border-[#e7e0d8] bg-white px-2.5 text-[11.5px] font-semibold text-[#1c1917] transition hover:border-[#cfc6bb]"
    >
      {ok ? "Copiado ✓" : label}
    </button>
  );
}

export function AppealsInbox() {
  const [appeals, setAppeals] = useState<StaffAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/appeals/staff", { cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean; error?: string; appeals?: StaffAppeal[] };
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo cargar.");
      return { appeals: json.appeals ?? [], error: null };
    } catch (e) {
      return { appeals: null, error: e instanceof Error ? e.message : "No se pudo cargar." };
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void load().then((r) => {
      if (!alive) return;
      setLoading(false);
      if (r.appeals) setAppeals(r.appeals);
      setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: appeals.length, open: 0 };
    for (const a of appeals) {
      c[a.status] = (c[a.status] ?? 0) + 1;
      if (a.status === "pending" || a.status === "sent") c.open = (c.open ?? 0) + 1;
    }
    return c;
  }, [appeals]);

  const visible = appeals.filter((a) =>
    filter === "all" ? true : filter === "open" ? a.status === "pending" || a.status === "sent" : a.status === filter,
  );

  async function setStatus(a: StaffAppeal, status: AppealStatus) {
    setSaving(a.id);
    setError(null);
    try {
      const res = await fetch("/api/appeals/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, status, staffNotes: notes[a.id] ?? a.staffNotes ?? "" }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; appeal?: AppealRecord };
      if (!res.ok || !json.ok || !json.appeal) throw new Error(json.error || "No se pudo guardar.");
      const updated = json.appeal;
      setAppeals((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...updated } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              filter === f.key
                ? "border-[#1c1917] bg-[#1c1917] text-white"
                : "border-[#e7e0d8] bg-white text-[#5c564e] hover:border-[#cfc6bb]"
            }`}
          >
            {f.label}
            <span className={`ml-1.5 tabular-nums ${filter === f.key ? "text-white/70" : "text-[#a39a90]"}`}>
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="rounded-2xl border border-[#ece7e0] bg-white px-5 py-10 text-center text-[13px] text-[#8a8177]">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#e0d8ce] bg-[#faf8f5] px-5 py-10 text-center text-[13px] text-[#8a8177]">
          No hay apelaciones en esta vista.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((a) => {
            const expanded = openId === a.id;
            const ui = STATUS_UI[a.status];
            return (
              <li key={a.id} className="overflow-hidden rounded-2xl border border-[#ece7e0] bg-white">
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : a.id)}
                  aria-expanded={expanded}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-[#faf8f5] sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-[#1c1917]">{a.hecomClienteName ?? a.companyName}</p>
                    <p className="mt-0.5 truncate text-[12px] text-[#6b645c]">
                      {a.advertiserName ?? a.advertiserId}
                      {a.bmLabel ? ` · ${a.bmLabel}` : ""} · {fmtDate(a.createdAt)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${ui.chip}`}>{ui.label}</span>
                </button>

                {expanded ? (
                  <div className="grid gap-4 border-t border-[#f0ebe4] px-4 py-4 sm:px-5 lg:grid-cols-[1fr_1.15fr]">
                    <div className="flex flex-col gap-3">
                      <div className="rounded-xl bg-[#f6f4f1] px-3.5 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a8177]">Cuenta</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="min-w-0 break-all font-mono text-[13px] font-semibold text-[#1c1917]">{a.advertiserId}</p>
                          <CopyBtn value={a.advertiserId} label="Copiar ID" />
                        </div>
                        {a.suspensionReason ? (
                          <p className="mt-2 text-[11.5px] italic leading-5 text-[#6b645c]">“{a.suspensionReason}”</p>
                        ) : null}
                        {a.suspensionUntil ? (
                          <p className="mt-1 text-[11.5px] text-[#6b645c]">Suspendida hasta {new Date(a.suspensionUntil).toLocaleDateString("es-PE")}</p>
                        ) : null}
                      </div>

                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
                        {[
                          ["Empresa", a.companyName],
                          ["RUC / doc.", a.taxId],
                          ["Tienda", a.storeUrl],
                          ["Vende", a.products],
                          ["Correo", a.contactEmail],
                          ["Teléfono", a.contactPhone],
                          ["Nota cliente", a.clientNotes],
                        ]
                          .filter(([, v]) => v)
                          .map(([k, v]) => (
                            <div key={k} className="contents">
                              <dt className="text-[#8a8177]">{k}</dt>
                              <dd className="min-w-0 break-words font-medium text-[#1c1917]">
                                {k === "Tienda" ? (
                                  <a href={String(v)} target="_blank" rel="noreferrer" className="text-[#c2410c] underline-offset-2 hover:underline">
                                    {v}
                                  </a>
                                ) : (
                                  v
                                )}
                              </dd>
                            </div>
                          ))}
                      </dl>

                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a8177]">
                          Documentos ({a.attachments.length})
                        </p>
                        {a.attachments.length ? (
                          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {a.attachments.map((f) => {
                              const url = a.attachmentUrls[f.path];
                              const img = f.mimeType.startsWith("image/");
                              return (
                                <li key={f.path}>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={f.name}
                                    className="block overflow-hidden rounded-lg border border-[#ece7e0] bg-[#faf8f5] transition hover:border-[#cfc6bb]"
                                  >
                                    {img && url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={url} alt={f.name} className="h-20 w-full object-cover" />
                                    ) : (
                                      <span className="flex h-20 items-center justify-center text-[12px] font-bold text-[#8a8177]">PDF</span>
                                    )}
                                    <span className="block truncate px-2 py-1 text-[10.5px] text-[#5c564e]">{f.name}</span>
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="mt-1 text-[12px] text-[#8a8177]">El cliente no adjuntó documentos.</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="rounded-xl border border-[#ece7e0]">
                        <div className="flex items-center justify-between gap-2 border-b border-[#f0ebe4] px-3.5 py-2.5">
                          <p className="text-[12.5px] font-bold text-[#1c1917]">Mensaje para TikTok (inglés)</p>
                          <CopyBtn value={a.appealMessage} label="Copiar mensaje" />
                        </div>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-3.5 py-3 font-sans text-[12.5px] leading-5 text-[#3f3a35]">
                          {a.appealMessage}
                        </pre>
                      </div>

                      <ol className="list-decimal space-y-0.5 rounded-xl bg-[#f6f4f1] px-3.5 py-3 pl-8 text-[12px] leading-5 text-[#5c564e]">
                        <li>
                          Abre{" "}
                          <a href="https://ads.tiktok.com/" target="_blank" rel="noreferrer" className="font-semibold text-[#c2410c] underline-offset-2 hover:underline">
                            TikTok Ads Manager
                          </a>{" "}
                          con el BM de la cuenta.
                        </li>
                        <li>Ayuda (?) → Submit ticket → Account Review → Account Suspension Appeal.</li>
                        <li>Pega el ID, el mensaje y adjunta los documentos.</li>
                        <li>Marca aquí «Enviada a TikTok».</li>
                      </ol>

                      <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a8177]">
                        Nota interna
                        <textarea
                          className="mt-1.5 min-h-[3.5rem] w-full resize-y rounded-xl border border-[#e7e0d8] bg-[#faf8f5] px-3 py-2 text-[12.5px] font-medium normal-case tracking-normal text-[#1c1917] outline-none focus:border-[#cfc6bb] focus:bg-white"
                          value={notes[a.id] ?? a.staffNotes ?? ""}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          placeholder="N.º de ticket de TikTok, respuesta, etc."
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        {a.status === "pending" ? (
                          <button
                            type="button"
                            disabled={saving === a.id}
                            onClick={() => void setStatus(a, "sent")}
                            className="inline-flex h-10 items-center rounded-xl bg-[#1c1917] px-4 text-[13px] font-semibold text-white transition hover:bg-[#3a342e] disabled:opacity-50"
                          >
                            Marcar enviada a TikTok
                          </button>
                        ) : null}
                        {a.status === "pending" || a.status === "sent" ? (
                          <>
                            <button
                              type="button"
                              disabled={saving === a.id}
                              onClick={() => void setStatus(a, "approved")}
                              className="inline-flex h-10 items-center rounded-xl border border-[#abefc6] bg-[#ecfdf3] px-4 text-[13px] font-semibold text-[#067647] transition hover:bg-[#d1fadf] disabled:opacity-50"
                            >
                              TikTok la aprobó
                            </button>
                            <button
                              type="button"
                              disabled={saving === a.id}
                              onClick={() => void setStatus(a, "rejected")}
                              className="inline-flex h-10 items-center rounded-xl border border-[#fecdca] bg-white px-4 text-[13px] font-semibold text-[#b42318] transition hover:bg-[#fef3f2] disabled:opacity-50"
                            >
                              TikTok la rechazó
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={saving === a.id}
                            onClick={() => void setStatus(a, a.status)}
                            className="inline-flex h-10 items-center rounded-xl border border-[#e7e0d8] bg-white px-4 text-[13px] font-semibold text-[#1c1917] transition hover:border-[#cfc6bb] disabled:opacity-50"
                          >
                            Guardar nota
                          </button>
                        )}
                      </div>
                      {a.sentAt ? <p className="text-[11.5px] text-[#8a8177]">Enviada a TikTok: {fmtDate(a.sentAt)}</p> : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
