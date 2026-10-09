"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  APPEAL_MAX_FILES,
  APPEAL_MAX_FILE_BYTES,
  APPEAL_MIME_TYPES,
} from "@/lib/appeals/account-appeals.shared";
import type { PaymentAccountAllocation } from "@/types/payment";

/** Se monta al abrir (con `key` por cuenta): el estado arranca limpio cada vez. */
interface AppealAccountModalProps {
  account: PaymentAccountAllocation;
  onClose: () => void;
  onSubmitted: (advertiserId: string) => void;
}

type Prefill = {
  account: { advertiserId: string; name: string; bmLabel: string | null };
  suspension: { reason: string | null; until: string | null };
  companyName: string;
  taxId: string;
  contactEmail: string;
  contactPhone: string;
};

type Fields = {
  companyName: string;
  taxId: string;
  storeUrl: string;
  products: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
};

const EMPTY: Fields = {
  companyName: "",
  taxId: "",
  storeUrl: "",
  products: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[#e7e0d8] bg-[#faf8f5] px-3.5 py-2.5 text-[13px] font-medium text-[#1c1917] outline-none transition focus:border-[#cfc6bb] focus:bg-white focus:ring-2 focus:ring-[#1c1917]/8";
const labelClass = "block text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a8177]";

export function AppealAccountModal({ account, onClose, onSubmitted }: AppealAccountModalProps) {
  const t = useTranslations("appeals");
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [longBan, setLongBan] = useState(false);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function draft(current: Fields, names: string[]) {
    setDrafting(true);
    try {
      const res = await fetch("/api/appeals/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId: account.id, ...current, attachmentNames: names }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !json.ok || !json.message) throw new Error(json.error || t("errDraft"));
      setMessage(json.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errDraft"));
    } finally {
      setDrafting(false);
    }
  }

  useEffect(() => {
    let alive = true;
    void fetch(`/api/appeals?adAccountId=${encodeURIComponent(account.id)}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as { ok?: boolean; error?: string; prefill?: Prefill };
        if (!alive) return;
        if (!res.ok || !json.ok || !json.prefill) throw new Error(json.error || t("errLoad"));
        const p = json.prefill;
        const next: Fields = {
          ...EMPTY,
          companyName: p.companyName,
          taxId: p.taxId,
          contactEmail: p.contactEmail,
          contactPhone: p.contactPhone,
        };
        setPrefill(p);
        setLongBan(
          p.suspension.until
            ? new Date(p.suspension.until).getTime() - Date.now() > 365 * 24 * 3600 * 1000
            : false,
        );
        setFields(next);
        setLoading(false);
        await draft(next, []);
      })
      .catch((e) => {
        if (!alive) return;
        setLoading(false);
        setError(e instanceof Error ? e.message : t("errLoad"));
      });
    return () => {
      alive = false;
    };
    // Una sola carga al abrir; draft y t no cambian mientras está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof Fields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!APPEAL_MIME_TYPES.includes(f.type)) {
        setError(t("errFileType", { name: f.name }));
        continue;
      }
      if (f.size > APPEAL_MAX_FILE_BYTES) {
        setError(t("errFileSize", { name: f.name }));
        continue;
      }
      if (next.length >= APPEAL_MAX_FILES) {
        setError(t("errFileCount", { max: APPEAL_MAX_FILES }));
        break;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  }

  const canSend =
    !loading &&
    !drafting &&
    !sending &&
    fields.companyName.trim().length > 1 &&
    fields.storeUrl.trim().length > 3 &&
    fields.products.trim().length > 2 &&
    message.trim().length > 40;

  async function submit() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("adAccountId", account.id);
      for (const [k, v] of Object.entries(fields)) form.set(k, v);
      form.set("appealMessage", message);
      for (const f of files) form.append("files", f);
      const res = await fetch("/api/appeals", { method: "POST", body: form });
      const json = (await res.json()) as { ok?: boolean; error?: string; appeal?: { advertiserId: string } };
      if (!res.ok || !json.ok || !json.appeal) throw new Error(json.error || t("errSend"));
      setDone(true);
      onSubmitted(json.appeal.advertiserId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errSend"));
    } finally {
      setSending(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/45 backdrop-blur-sm"
        aria-label={t("close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="appeal-title"
        className="relative max-h-[min(92vh,calc(100dvh-2rem))] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#ece7e0] bg-white shadow-2xl"
      >
        {done ? (
          <div className="px-6 py-10 text-center sm:px-8">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
              <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <h2 className="mt-4 text-[1.15rem] font-bold tracking-[-0.02em] text-[#1c1917]">{t("doneTitle")}</h2>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-[#5c564e]">{t("doneBody")}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#1c1917] px-6 text-[13px] font-semibold text-white transition hover:bg-[#3a342e]"
            >
              {t("doneCta")}
            </button>
          </div>
        ) : (
          <>
            <div className="border-b border-[#f0ebe4] px-5 py-5 sm:px-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#c2410c]">{t("eyebrow")}</p>
              <h2 id="appeal-title" className="mt-1 text-[1.2rem] font-bold tracking-[-0.025em] text-[#1c1917]">
                {t("title")}
              </h2>
              <p className="mt-0.5 truncate text-[12.5px] text-[#5c564e]">
                {account.name}
                {account.bmLabel ? ` · ${account.bmLabel}` : ""} · adv {account.externalAccountId}
              </p>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-7">
              <section className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3.5">
                <p className="text-[13px] font-bold text-amber-950">{t("detectedTitle")}</p>
                <p className="mt-1 text-[12.5px] leading-5 text-amber-950/90">
                  {t("detectedBody")}
                  {longBan ? ` ${t("longBan")}` : ""}
                </p>
                {prefill?.suspension.reason ? (
                  <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-[11.5px] italic leading-5 text-amber-950/80">
                    “{prefill.suspension.reason}”
                  </p>
                ) : null}
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-900">
                  {t("causesTitle")}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] leading-5 text-amber-950/90">
                  <li>{t("cause1")}</li>
                  <li>{t("cause2")}</li>
                  <li>{t("cause3")}</li>
                  <li>{t("cause4")}</li>
                </ul>
                <p className="mt-3 text-[12.5px] font-semibold leading-5 text-amber-950">{t("weHandle")}</p>
              </section>

              {loading ? (
                <p className="py-6 text-center text-[13px] text-[#8a8177]">{t("loading")}</p>
              ) : (
                <>
                  <section>
                    <h3 className="text-[14px] font-bold text-[#1c1917]">{t("step1")}</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className={`${labelClass} sm:col-span-2`}>
                        {t("companyName")} *
                        <input className={inputClass} value={fields.companyName} onChange={(e) => set("companyName", e.target.value)} />
                      </label>
                      <label className={labelClass}>
                        {t("taxId")}
                        <input className={inputClass} value={fields.taxId} onChange={(e) => set("taxId", e.target.value)} placeholder="20601234567" />
                      </label>
                      <label className={labelClass}>
                        {t("storeUrl")} *
                        <input className={inputClass} value={fields.storeUrl} onChange={(e) => set("storeUrl", e.target.value)} placeholder="https://mitienda.com" inputMode="url" />
                      </label>
                      <label className={`${labelClass} sm:col-span-2`}>
                        {t("products")} *
                        <input className={inputClass} value={fields.products} onChange={(e) => set("products", e.target.value)} placeholder={t("productsPh")} />
                      </label>
                      <label className={labelClass}>
                        {t("email")}
                        <input className={inputClass} value={fields.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} inputMode="email" />
                      </label>
                      <label className={labelClass}>
                        {t("phone")}
                        <input className={inputClass} value={fields.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} inputMode="tel" />
                      </label>
                      <label className={`${labelClass} sm:col-span-2`}>
                        {t("notes")}
                        <textarea className={`${inputClass} min-h-[4.5rem] resize-y`} value={fields.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("notesPh")} />
                      </label>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-[14px] font-bold text-[#1c1917]">{t("step2")}</h3>
                    <p className="mt-1 text-[12px] leading-5 text-[#5c564e]">{t("docsHint")}</p>
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="mt-3 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e0d8ce] bg-[#faf8f5] px-4 py-5 text-center transition hover:border-[#ff781f]/50 hover:bg-[#fff8f2]"
                    >
                      <span className="text-[13px] font-semibold text-[#1c1917]">{t("addDocs")}</span>
                      <span className="mt-0.5 text-[11px] text-[#8a8177]">{t("docsLimits", { max: APPEAL_MAX_FILES })}</span>
                    </button>
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      accept={APPEAL_MIME_TYPES.join(",")}
                      className="hidden"
                      onChange={(e) => addFiles(e.target.files)}
                    />
                    {files.length ? (
                      <ul className="mt-2 space-y-1.5">
                        {files.map((f, i) => (
                          <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-[#f6f4f1] px-3 py-2 text-[12px]">
                            <span className="min-w-0 truncate font-medium text-[#1c1917]">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => setFiles(files.filter((_, j) => j !== i))}
                              className="shrink-0 text-[11px] font-semibold text-[#8a8177] hover:text-[#b91c1c]"
                            >
                              {t("remove")}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>

                  <section>
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h3 className="text-[14px] font-bold text-[#1c1917]">{t("step3")}</h3>
                        <p className="mt-1 text-[12px] leading-5 text-[#5c564e]">{t("messageHint")}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void draft(fields, files.map((f) => f.name))}
                        disabled={drafting}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e7e0d8] bg-white px-3 text-[12px] font-semibold text-[#1c1917] transition hover:border-[#cfc6bb] disabled:opacity-50"
                      >
                        <span aria-hidden>✦</span>
                        {drafting ? t("drafting") : t("redraft")}
                      </button>
                    </div>
                    <textarea
                      className={`${inputClass} mt-3 min-h-[12rem] resize-y font-normal leading-5 ${drafting ? "opacity-50" : ""}`}
                      value={drafting && !message ? t("draftingLong") : message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={drafting}
                      lang="en"
                    />
                  </section>
                </>
              )}

              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] font-medium text-red-700" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-[#f0ebe4] bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center rounded-xl border border-[#e7e0d8] bg-white px-4 text-[13px] font-semibold text-[#5c564e] transition hover:border-[#cfc6bb]"
              >
                {t("close")}
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!canSend}
                className="inline-flex h-11 items-center rounded-xl bg-[#ff781f] px-5 text-[13px] font-semibold text-white transition hover:bg-[#f06a12] disabled:opacity-50"
              >
                {sending ? t("sending") : t("send")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
