"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { ManualPaymentIntentItem } from "@/services/payments.service";
import { listRecentPeriodos } from "@/lib/payments/missing-cobro.shared";

type ClaimForm = {
  amountUsd: string;
  periodoResumen: string;
  paymentFecha: string;
  metodo: string;
  operationCode: string;
  amountPen: string;
  notes: string;
};

const METODOS = ["Interbank", "BCP", "Yape", "Plin", "Otro"] as const;

function todayLimaYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function reviewLabel(
  status: ManualPaymentIntentItem["reviewStatus"],
  t: ReturnType<typeof useTranslations>,
): string {
  switch (status) {
    case "awaiting_proof":
      return t("missingCobro.statusAwaiting");
    case "pending_review":
      return t("missingCobro.statusPending");
    case "approved":
      return t("missingCobro.statusApproved");
    case "rejected":
      return t("missingCobro.statusRejected");
    default:
      return status;
  }
}

export function MissingCobroClaimPanel({
  periodos: periodosProp,
  initialClaims,
  endpoints,
  presentation = "default",
}: {
  periodos?: string[];
  initialClaims?: ManualPaymentIntentItem[];
  presentation?: "default" | "portal";
  /** Link público: listar, crear y subir sin sesión. */
  endpoints?: {
    claims: string;
    proof: (paymentIntentId: string) => string;
  };
}) {
  const t = useTranslations("cobros");
  const router = useRouter();
  const id = useId();
  const formId = `${id}-form`;
  const fileId = `${id}-proof`;
  const isPortal = presentation === "portal";
  const periodos = useMemo(
    () => (periodosProp?.length ? periodosProp : listRecentPeriodos(6)),
    [periodosProp],
  );

  const [open, setOpen] = useState(false);
  const [claims, setClaims] = useState<ManualPaymentIntentItem[]>(
    initialClaims ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingIntentId, setPendingIntentId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ClaimForm>(() => ({
    amountUsd: "",
    periodoResumen: periodos[0] ?? "",
    paymentFecha: todayLimaYmd(),
    metodo: "Interbank",
    operationCode: "",
    amountPen: "",
    notes: "",
  }));

  // Keep the portal in its allowed months, including after a GET refresh.
  const visibleClaims = isPortal
    ? claims.filter(
        (claim) =>
          claim.periodoResumen != null && periodos.includes(claim.periodoResumen),
      )
    : claims;
  const fieldLabelClass = isPortal
    ? "font-medium text-[var(--admin-text)]"
    : "font-medium text-[var(--auth-text)]";
  const fieldClass = isPortal
    ? "mt-1 min-h-11 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-[var(--admin-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
    : "mt-1 w-full rounded-lg border border-[var(--auth-divider)] bg-white px-3 py-2";
  const claimsEndpoint = endpoints?.claims ?? "/api/payments/missing-cobro";

  const refreshClaims = useCallback(
    () =>
      apiClient<{
        ok: boolean;
        claims: ManualPaymentIntentItem[];
      }>(claimsEndpoint)
        .then((res) => setClaims(res.claims ?? []))
        .catch(() => {
          /* keep existing */
        }),
    [claimsEndpoint],
  );

  useEffect(() => {
    if (!initialClaims) void refreshClaims();
  }, [initialClaims, refreshClaims]);

  async function handleCreateAndUpload() {
    setError(null);
    setSuccess(null);
    const amountUsd = Number.parseFloat(form.amountUsd.replace(",", "."));
    if (!Number.isFinite(amountUsd) || amountUsd < 1) {
      setError(isPortal ? "Indica el monto del pago en USD (mínimo $1)." : t("missingCobro.errAmount"));
      return;
    }
    if (!form.periodoResumen || !form.paymentFecha) {
      setError(t("missingCobro.errPeriod"));
      return;
    }
    if (!file) {
      setError(t("missingCobro.errFile"));
      return;
    }

    setBusy(true);
    try {
      const created = await apiClient<{
        ok: boolean;
        paymentIntentId: string;
        message?: string;
      }> (endpoints?.claims ?? "/api/payments/missing-cobro", {
        method: "POST",
        body: JSON.stringify({
          amountUsd,
          periodoResumen: form.periodoResumen,
          paymentFecha: form.paymentFecha,
          metodo: form.metodo,
          operationCode: form.operationCode || undefined,
          notes: form.notes || undefined,
          amountPen: form.amountPen
            ? Number.parseFloat(form.amountPen.replace(",", "."))
            : undefined,
        }),
      });

      setPendingIntentId(created.paymentIntentId);
      setUploading(true);

      const fd = new FormData();
      fd.append("proof", file);
      await apiClient(
        endpoints?.proof(created.paymentIntentId) ??
          `/api/payments/intents/${created.paymentIntentId}/proof`,
        {
        method: "POST",
        body: fd,
      });

      setSuccess(isPortal ? "Comprobante recibido. Tu pago está en revisión." : t("missingCobro.success"));
      setOpen(false);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setForm((f) => ({
        ...f,
        amountUsd: "",
        operationCode: "",
        amountPen: "",
        notes: "",
        paymentFecha: todayLimaYmd(),
      }));
      await refreshClaims();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("missingCobro.errGeneric"),
      );
    } finally {
      setBusy(false);
      setUploading(false);
      setPendingIntentId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div
        className={isPortal ? "space-y-4" : [
          "relative overflow-hidden rounded-2xl border border-[var(--auth-divider)]",
          "bg-gradient-to-br from-[#fff8f1] via-white to-[#f4f7fb]",
          "p-4 sm:p-5",
        ].join(" ")}
      >
        {!isPortal ? <div
          className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[#ff781f]/10 blur-2xl"
          aria-hidden
        /> : null}
        <div className={isPortal ? "space-y-3" : "relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"}>
          {isPortal ? (
            <p className="text-[13px] leading-5 text-[var(--admin-text-muted)]">
              Si tu pago no aparece en el historial, envía los datos y el
              comprobante para que podamos revisarlo.
            </p>
          ) : (
          <div className="min-w-0 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#b45309]">
              {t("missingCobro.eyebrow")}
            </p>
            <h3 className="mt-1 text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)] sm:text-[1.125rem]">
              {t("missingCobro.title")}
            </h3>
            <p className="mt-1.5 text-[13px] leading-5 text-[var(--auth-text-muted)]">
              {t("missingCobro.body")}
            </p>
            <p className="mt-2 text-[11px] leading-4 text-[var(--auth-text-soft)]">
              {t("missingCobro.noWalletHint")}
            </p>
          </div>
          )}
          <Button
            type="button"
            size="sm"
            className={isPortal ? "min-h-11 w-full bg-[#c2410c] text-white hover:bg-[#9a3412]" : "shrink-0 self-start sm:self-center"}
            aria-expanded={open}
            aria-controls={open ? formId : undefined}
            onClick={() => {
              setOpen((v) => !v);
              setError(null);
              setSuccess(null);
            }}
          >
            {open ? t("missingCobro.cancel") : t("missingCobro.cta")}
          </Button>
        </div>

        {success ? (
          <p role="status" className={isPortal ? "rounded-lg bg-[var(--admin-badge-success-bg)] px-3 py-2 text-[13px] text-[var(--admin-badge-success-text)]" : "relative mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900"}>
            {success}
          </p>
        ) : null}

        {open ? (
          <div id={formId} className={isPortal ? "space-y-4 border-t border-[var(--admin-border)] pt-4" : "relative mt-4 space-y-3 rounded-xl border border-[var(--auth-divider)] bg-white/90 p-3 shadow-sm sm:p-4"}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px]">
                <span className={fieldLabelClass}>
                  {t("missingCobro.period")}
                </span>
                <select
                  className={fieldClass}
                  value={form.periodoResumen}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, periodoResumen: e.target.value }))
                  }
                >
                  {periodos.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px]">
                <span className={fieldLabelClass}>
                  {isPortal ? "Fecha del pago" : t("missingCobro.paymentDate")}
                </span>
                <input
                  type="date"
                  className={fieldClass}
                  value={form.paymentFecha}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paymentFecha: e.target.value }))
                  }
                />
              </label>
              <label className="block text-[12px]">
                <span className={fieldLabelClass}>
                  {t("missingCobro.amountUsd")}
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  inputMode="decimal"
                  className={fieldClass}
                  value={form.amountUsd}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amountUsd: e.target.value }))
                  }
                  placeholder="188.73"
                />
              </label>
              <label className="block text-[12px]">
                <span className={fieldLabelClass}>
                  {t("missingCobro.amountPenOptional")}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className={fieldClass}
                  value={form.amountPen}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amountPen: e.target.value }))
                  }
                  placeholder="636.38"
                />
              </label>
              <label className="block text-[12px]">
                <span className={fieldLabelClass}>
                  {t("missingCobro.method")}
                </span>
                <select
                  className={fieldClass}
                  value={form.metodo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, metodo: e.target.value }))
                  }
                >
                  {METODOS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px]">
                <span className={fieldLabelClass}>
                  {isPortal ? "Código de operación (opcional)" : t("missingCobro.opCode")}
                </span>
                <input
                  type="text"
                  className={fieldClass}
                  value={form.operationCode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, operationCode: e.target.value }))
                  }
                  placeholder="01048566"
                />
              </label>
            </div>
            <label className="block text-[12px]">
              <span className={fieldLabelClass}>
                {t("missingCobro.notes")}
              </span>
              <textarea
                className={fieldClass}
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </label>
            <div className="block text-[12px]">
              <label htmlFor={fileId} className={fieldLabelClass}>
                {t("missingCobro.voucher")}
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={[
                  "mt-1.5 flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-3 py-3.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]",
                  isPortal
                    ? file
                      ? "border-[var(--admin-success)] bg-[var(--admin-badge-success-bg)]"
                      : "border-[var(--admin-border-strong)] bg-[var(--admin-surface-soft)] hover:border-[var(--admin-accent)]"
                    : file
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-[#ff781f]/70 bg-[#fff8f1] hover:border-[#ff781f] hover:bg-[#fff1e6]",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[18px]",
                    isPortal
                      ? file
                        ? "bg-[var(--admin-badge-success-bg)] text-[var(--admin-badge-success-text)]"
                        : "bg-[var(--admin-surface-hover)] text-[var(--admin-text)]"
                      : file
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-[#ff781f] text-white",
                  ].join(" ")}
                  aria-hidden
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={file ? "m5 12 4 4L19 6" : "M12 16V4m-5 5 5-5 5 5M5 16v4h14v-4"} />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className={isPortal ? "block break-all text-[13px] font-semibold text-[var(--admin-text)]" : "block text-[13px] font-semibold text-[var(--auth-text)]"}>
                    {file ? file.name : t("missingCobro.voucherPick")}
                  </span>
                  <span className={isPortal ? "mt-0.5 block text-xs leading-5 text-[var(--admin-text-muted)]" : "mt-0.5 block text-[11px] text-[var(--auth-text-muted)]"}>
                    {file
                      ? t("missingCobro.voucherReady")
                      : t("missingCobro.voucherHint")}
                  </span>
                </span>
              </button>
              <input
                ref={fileInputRef}
                id={fileId}
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {error ? (
              <p className={isPortal ? "text-[13px] text-[var(--admin-badge-danger-text)]" : "text-[12px] text-red-600"} role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                className={isPortal ? "min-h-11 w-full bg-[#c2410c] text-white hover:bg-[#9a3412]" : undefined}
                onClick={() => void handleCreateAndUpload()}
              >
                {busy
                  ? uploading
                    ? t("missingCobro.uploading")
                    : isPortal ? "Preparando envío…" : t("missingCobro.creating")
                  : t("missingCobro.submit")}
              </Button>
              {pendingIntentId ? (
                <span className={isPortal ? "self-center text-xs text-[var(--admin-text-muted)]" : "self-center font-mono text-[10px] text-[var(--auth-muted)]"}>
                  {pendingIntentId.slice(0, 8)}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {visibleClaims.length > 0 ? (
        <div className={isPortal ? "space-y-2 border-t border-[var(--admin-border)] pt-4" : "space-y-2 rounded-2xl border border-[var(--auth-divider)] bg-white p-4"}>
          <p className={isPortal ? "text-sm font-semibold text-[var(--admin-text)]" : "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]"}>
            {isPortal ? "Comprobantes enviados" : t("missingCobro.myReports")}
          </p>
          <ul className={isPortal ? "divide-y divide-[var(--admin-border)]" : "divide-y divide-[var(--auth-divider)] rounded-xl border border-[var(--auth-divider)]"}>
            {visibleClaims.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[12px]"
              >
                <div className="min-w-0">
                  <p className={isPortal ? "font-semibold tabular-nums text-[var(--admin-text)]" : "font-semibold tabular-nums text-[var(--auth-text)]"}>
                    ${c.amount.toFixed(2)} USD
                    {c.periodoResumen ? ` · ${c.periodoResumen}` : ""}
                  </p>
                  <p className={isPortal ? "break-words text-xs leading-5 text-[var(--admin-text-muted)]" : "text-[11px] text-[var(--auth-muted)]"}>
                    {c.claimedPaymentFecha ??
                      new Date(c.createdAt).toLocaleDateString("es-PE")}
                    {c.claimedMetodo ? ` · ${c.claimedMetodo}` : ""}
                    {c.failureReason && c.reviewStatus === "rejected"
                      ? ` · ${c.failureReason}`
                      : ""}
                  </p>
                </div>
                <Badge
                  variant={
                    c.reviewStatus === "approved"
                      ? "success"
                      : c.reviewStatus === "rejected"
                        ? "default"
                        : c.reviewStatus === "pending_review"
                          ? "info"
                          : "warning"
                  }
                >
                  {isPortal && c.reviewStatus === "awaiting_proof"
                    ? "Falta comprobante"
                    : reviewLabel(c.reviewStatus, t)}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
