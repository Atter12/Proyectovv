"use client";

import { useMemo, useState, useTransition } from "react";
import type { PartnerWithStats } from "@/lib/partners/partners-admin.server";
import {
  assignClientToPartnerAction,
  markPartnerCommissionsPaidAction,
  savePartnerAction,
  setPartnerStatusAction,
  type PartnerInput,
} from "../actions";

const SITE = "https://www.adsholistic.com";
const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

const EMPTY: PartnerInput = {
  id: null,
  slug: "",
  name: "",
  headline: "",
  subheadline: "",
  logoUrl: "",
  photoUrl: "",
  accentColor: "#ff781f",
  whatsapp: "",
  commissionPercent: 20,
  commissionMonths: 12,
  notes: "",
};

function toInput(p: PartnerWithStats): PartnerInput {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    headline: p.headline ?? "",
    subheadline: p.subheadline ?? "",
    logoUrl: p.logoUrl ?? "",
    photoUrl: p.photoUrl ?? "",
    accentColor: p.accentColor,
    whatsapp: p.whatsapp ?? "",
    commissionPercent: Math.round(p.commissionRate * 10000) / 100,
    commissionMonths: p.commissionMonths,
    notes: p.notes ?? "",
  };
}

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function AlianzasPanel({ partners }: { partners: PartnerWithStats[] }) {
  const [form, setForm] = useState<PartnerInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ranked = useMemo(
    () => [...partners].sort((a, b) => b.stats.payingClients - a.stats.payingClients || b.stats.signups - a.stats.signups || b.stats.visits30d - a.stats.visits30d),
    [partners],
  );
  const totals = useMemo(
    () =>
      partners.reduce(
        (t, p) => ({
          visits: t.visits + p.stats.visits30d,
          signups: t.signups + p.stats.signups,
          paying: t.paying + p.stats.payingClients,
          pendingCents: t.pendingCents + p.stats.commissionPendingCents,
        }),
        { visits: 0, signups: 0, paying: 0, pendingCents: 0 },
      ),
    [partners],
  );

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        setNotice(ok);
        setForm(null);
      } else setError(result.error);
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Link copiado.");
    } catch {
      setError("No se pudo copiar el link.");
    }
  }

  const update = <K extends keyof PartnerInput>(key: K, value: PartnerInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Visitas (30 días)", totals.visits.toLocaleString("es-PE")],
          ["Registros", totals.signups.toLocaleString("es-PE")],
          ["Clientes que pagan", totals.paying.toLocaleString("es-PE")],
          ["Comisión por pagar", usd(totals.pendingCents)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#ece5dc] bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8177]">{label}</p>
            <p className="mt-1 text-[1.35rem] font-bold tabular-nums tracking-[-0.02em] text-[#1c1917]">{value}</p>
          </div>
        ))}
      </div>

      {error ? <p className="rounded-xl bg-[#fff1ee] px-4 py-3 text-[13px] text-[#a32e23]">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#ecfdf3] px-4 py-3 text-[13px] text-[#067647]">{notice}</p> : null}

      {form ? (
        <form
          className="space-y-4 rounded-2xl border border-[#ece5dc] bg-white p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => savePartnerAction(form), form.id ? "Aliado actualizado." : "Aliado creado. Ya puedes copiar su link.");
          }}
        >
          <p className="text-[15px] font-bold">{form.id ? `Editar ${form.name}` : "Nuevo aliado"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del aliado *">
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => (f ? { ...f, name, slug: f.id || f.slug !== slugify(f.name) ? f.slug : slugify(name) } : f));
                }}
                placeholder="Comunidad Ecom Pro"
                required
              />
            </Field>
            <Field label="Link (adsholistic.com/a/…) *">
              <input className={inputCls} value={form.slug} onChange={(e) => update("slug", slugify(e.target.value))} placeholder="ecom-pro" required />
            </Field>
            <Field label="Título de la landing">
              <input className={inputCls} value={form.headline} onChange={(e) => update("headline", e.target.value)} placeholder="Lanza y escala tus campañas de TikTok" />
            </Field>
            <Field label="WhatsApp del aliado (opcional)">
              <input className={inputCls} value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="51999888777" inputMode="tel" />
            </Field>
            <Field label="Subtítulo" wide>
              <textarea className={`${inputCls} min-h-[72px] py-2`} value={form.subheadline} onChange={(e) => update("subheadline", e.target.value)} placeholder="La comunidad Ecom Pro ya anuncia con Ads Holistic…" />
            </Field>
            <Field label="Logo (link https)">
              <input className={inputCls} value={form.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://…/logo.png" />
            </Field>
            <Field label="Foto del aliado (link https)">
              <input className={inputCls} value={form.photoUrl} onChange={(e) => update("photoUrl", e.target.value)} placeholder="https://…/foto.jpg" />
            </Field>
            <Field label="Color de marca">
              <div className="flex items-center gap-2">
                <input type="color" className="h-10 w-12 cursor-pointer rounded-lg border border-[#e3dbd1]" value={form.accentColor} onChange={(e) => update("accentColor", e.target.value)} />
                <input className={inputCls} value={form.accentColor} onChange={(e) => update("accentColor", e.target.value)} />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Comisión (% del fee)">
                <input type="number" min={0} max={50} step={0.5} className={inputCls} value={form.commissionPercent} onChange={(e) => update("commissionPercent", Number(e.target.value))} />
              </Field>
              <Field label="Durante (meses)">
                <input type="number" min={1} max={120} className={inputCls} value={form.commissionMonths} onChange={(e) => update("commissionMonths", Number(e.target.value))} />
              </Field>
            </div>
            <Field label="Notas internas" wide>
              <input className={inputCls} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Acuerdo, contacto, forma de pago…" />
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={btnGhost} onClick={() => setForm(null)} disabled={pending}>
              Cancelar
            </button>
            <button type="submit" className={btnPrimary} disabled={pending}>
              {pending ? "Guardando…" : form.id ? "Guardar cambios" : "Crear aliado"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={btnPrimary} onClick={() => setForm({ ...EMPTY })}>
          + Nuevo aliado
        </button>
      )}

      {ranked.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#e3dbd1] px-4 py-8 text-center text-[13px] text-[#8a8177]">
          Aún no hay aliados. Crea el primero y comparte su link.
        </p>
      ) : (
        <ol className="space-y-3">
          {ranked.map((p, i) => {
            const url = `${SITE}/a/${p.slug}`;
            return (
              <li key={p.id} className="rounded-2xl border border-[#ece5dc] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[15px] font-bold">
                      <span className="text-[#b5ada5]">#{i + 1}</span>
                      <span className="truncate">{p.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${p.status === "active" ? "bg-[#ecfdf3] text-[#067647]" : "bg-[#f1ebe4] text-[#6f675f]"}`}>
                        {p.status === "active" ? "Activo" : "Pausado"}
                      </span>
                    </p>
                    <p className="mt-0.5 break-all text-[12px] text-[#8a8177]">{url}</p>
                    <p className="mt-0.5 text-[12px] text-[#8a8177]">
                      Comisión {Math.round(p.commissionRate * 1000) / 10}% del fee · {p.commissionMonths} meses por cliente
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnSmall} onClick={() => void copy(url)}>Copiar link</button>
                    {p.panelUrl ? (
                      <button type="button" className={btnSmall} onClick={() => void copy(p.panelUrl!)} title="Link privado: el aliado ve sus visitas, clientes y comisiones">
                        Link de su panel
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={btnSmall}
                      disabled={pending}
                      onClick={() => {
                        const email = window.prompt(`Correo del cliente que trajo ${p.name}:`);
                        if (!email) return;
                        run(() => assignClientToPartnerAction(p.id, email), "Cliente asignado al aliado.");
                      }}
                    >
                      Asignar cliente
                    </button>
                    <a className={btnSmall} href={`/a/${p.slug}`} target="_blank" rel="noreferrer">Abrir</a>
                    <button type="button" className={btnSmall} onClick={() => setForm(toInput(p))}>Editar</button>
                    <button
                      type="button"
                      className={btnSmall}
                      disabled={pending}
                      onClick={() => run(() => setPartnerStatusAction(p.id, p.status === "active" ? "paused" : "active"), p.status === "active" ? "Aliado pausado: su landing deja de funcionar." : "Aliado activado.")}
                    >
                      {p.status === "active" ? "Pausar" : "Activar"}
                    </button>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <Stat label="Visitas 30d" value={p.stats.visits30d} hint={`${p.stats.uniqueVisitors30d} únicas`} />
                  <Stat label="Visitas total" value={p.stats.visitsTotal} />
                  <Stat label="Registros" value={p.stats.signups} hint={`${pct(p.stats.signups, p.stats.uniqueVisitors30d)} de las únicas`} />
                  <Stat label="Pagan" value={p.stats.payingClients} hint={`${pct(p.stats.payingClients, p.stats.signups)} de registros`} />
                  <Stat label="Fee generado" value={usd(p.stats.feeCents)} />
                  <Stat label="Comisión" value={usd(p.stats.commissionPendingCents)} hint={`pagado ${usd(p.stats.commissionPaidCents)}`} />
                </dl>

                {p.stats.commissionPendingCents > 0 ? (
                  <button
                    type="button"
                    className={`${btnSmall} mt-3`}
                    disabled={pending}
                    onClick={() => {
                      const note = window.prompt(`¿Marcar como pagados ${usd(p.stats.commissionPendingCents)} a ${p.name}? Escribe la referencia del pago:`);
                      if (note == null) return;
                      run(() => markPartnerCommissionsPaidAction(p.id, note), "Comisiones marcadas como pagadas.");
                    }}
                  >
                    Marcar {usd(p.stats.commissionPendingCents)} como pagado
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-[#e3dbd1] bg-white px-3 text-[14px] outline-none focus:border-[#ff9a52] focus:ring-4 focus:ring-[#ffeadb]";
const btnPrimary =
  "inline-flex h-10 items-center justify-center rounded-xl bg-[#ff781f] px-5 text-[13px] font-bold text-[#1c1917] transition hover:bg-[#f56a0b] disabled:opacity-60";
const btnGhost =
  "inline-flex h-10 items-center justify-center rounded-xl border border-[#e3dbd1] bg-white px-5 text-[13px] font-semibold text-[#3a332d] disabled:opacity-60";
const btnSmall =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-[#e3dbd1] bg-white px-3 text-[12px] font-semibold text-[#3a332d] transition hover:bg-[#f7f5f2] disabled:opacity-60";

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[12px] font-semibold text-[#3a332d]">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl bg-[#faf7f3] px-3 py-2">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8a8177]">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-[#1c1917]">{value}</dd>
      {hint ? <dd className="text-[11px] text-[#8a8177]">{hint}</dd> : null}
    </div>
  );
}
