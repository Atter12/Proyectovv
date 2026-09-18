"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
}: {
  periodos?: string[];
  initialClaims?: ManualPaymentIntentItem[];
}) {
  const t = useTranslations("cobros");
  const router = useRouter();
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

  const [form, setForm] = useState<ClaimForm>(() => ({
    amountUsd: "",
    periodoResumen: periodos[0] ?? "",
    paymentFecha: todayLimaYmd(),
    metodo: "Interbank",
    operationCode: "",
    amountPen: "",
    notes: "",
  }));

  const refreshClaims = useCallback(async () => {
    try {
      const res = await apiClient<{
        ok: boolean;
        claims: ManualPaymentIntentItem[];
      }>("/api/payments/missing-cobro");
      setClaims(res.claims ?? []);
    } catch {
      /* keep existing */
    }
  }, []);

  useEffect(() => {
    if (!initialClaims) void refreshClaims();
  }, [initialClaims, refreshClaims]);

  async function handleCreateAndUpload() {
    setError(null);
    setSuccess(null);
    const amountUsd = Number.parseFloat(form.amountUsd.replace(",", "."));
    if (!Number.isFinite(amountUsd) || amountUsd < 1) {
      setError(t("missingCobro.errAmount"));
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
      }>("/api/payments/missing-cobro", {
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
      fd.append("file", file);
      await apiClient(`/api/payments/intents/${created.paymentIntentId}/proof`, {
        method: "POST",
        body: fd,
      });

      setSuccess(t("missingCobro.success"));
      setOpen(false);
      setFile(null);
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
        className={[
          "relative overflow-hidden rounded-2xl border border-[var(--auth-divider)]",
          "bg-gradient-to-br from-[#fff8f1] via-white to-[#f4f7fb]",
          "p-4 sm:p-5",
        ].join(" ")}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[#ff781f]/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          <Button
            type="button"
            size="sm"
            className="shrink-0 self-start sm:self-center"
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
          <p className="relative mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
            {success}
          </p>
        ) : null}

        {open ? (
          <div className="relative mt-4 space-y-3 rounded-xl border border-[var(--auth-divider)] bg-white/90 p-3 shadow-sm sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px]">
                <span className="font-medium text-[var(--auth-text)]">
                  {t("missingCobro.period")}
                </span>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--auth-divider)] bg-white px-3 py-2"
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
                <span className="font-medium text-[var(--auth-text)]">
                  {t("missingCobro.paymentDate")}
                </span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-[var(--auth-divider)] bg-white px-3 py-2"
                  value={form.paymentFecha}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paymentFecha: e.target.value }))
                  }
                />
              </label>
              <label className="block text-[12px]">
                <span className="font-medium text-[var(--auth-text)]">
                  {t("missingCobro.amountUsd")}
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-[var(--auth-divider)] bg-white px-3 py-2"
                  value={form.amountUsd}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amountUsd: e.target.value }))
                  }
                  placeholder="188.73"
                />
              </label>
              <label className="block text-[12px]">
                <span className="font-medium text-[var(--auth-text)]">
                  {t("missingCobro.amountPenOptional")}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-[var(--auth-divider)] bg-white px-3 py-2"
                  value={form.amountPen}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amountPen: e.target.value }))
                  }
                  placeholder="636.38"
                />
              </label>
              <label className="block text-[12px]">
                <span className="font-medium text-[var(--auth-text)]">
                  {t("missingCobro.method")}
                </span>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--auth-divider)] bg-white px-3 py-2"
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
                <span className="font-medium text-[var(--auth-text)]">
                  {t("missingCobro.opCode")}
                </span>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-[var(--auth-divider)] bg-white px-3 py-2"
                  value={form.operationCode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, operationCode: e.target.value }))
                  }
                  placeholder="01048566"
                />
              </label>
            </div>
            <label className="block text-[12px]">
              <span className="font-medium text-[var(--auth-text)]">
                {t("missingCobro.notes")}
              </span>
              <textarea
                className="mt-1 w-full rounded-lg border border-[var(--auth-divider)] bg-white px-3 py-2"
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </label>
            <label className="block text-[12px]">
              <span className="font-medium text-[var(--auth-text)]">
                {t("missingCobro.voucher")}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="mt-1 block w-full text-[12px]"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {error ? (
              <p className="text-[12px] text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void handleCreateAndUpload()}
              >
                {busy
                  ? uploading
                    ? t("missingCobro.uploading")
                    : t("missingCobro.creating")
                  : t("missingCobro.submit")}
              </Button>
              {pendingIntentId ? (
                <span className="self-center font-mono text-[10px] text-[var(--auth-muted)]">
                  {pendingIntentId.slice(0, 8)}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {claims.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-[var(--auth-divider)] bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
            {t("missingCobro.myReports")}
          </p>
          <ul className="divide-y divide-[var(--auth-divider)] rounded-xl border border-[var(--auth-divider)]">
            {claims.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[12px]"
              >
                <div className="min-w-0">
                  <p className="font-semibold tabular-nums text-[var(--auth-text)]">
                    ${c.amount.toFixed(2)} USD
                    {c.periodoResumen ? ` · ${c.periodoResumen}` : ""}
                  </p>
                  <p className="text-[11px] text-[var(--auth-muted)]">
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
                  {reviewLabel(c.reviewStatus, t)}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
