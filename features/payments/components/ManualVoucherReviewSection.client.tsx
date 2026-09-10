"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format-money";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { ManualPaymentIntentItem } from "@/services/payments.service";
import {
  formatPenAmount,
  quoteFromGrossCharge,
} from "@/lib/payments/manual-deposit.shared";

const reviewLabels = {
  awaiting_proof: "Falta voucher",
  pending_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
} as const;

const reviewVariants = {
  awaiting_proof: "warning",
  pending_review: "info",
  approved: "success",
  rejected: "default",
  cancelled: "default",
} as const;

function isImageMime(mime: string | null, fileName: string | null): boolean {
  if (mime?.startsWith("image/")) return true;
  const name = (fileName ?? "").toLowerCase();
  return /\.(png|jpe?g|webp|gif)$/.test(name);
}

function VoucherCard({
  intent,
  canReview,
  product = "wallet",
}: {
  intent: ManualPaymentIntentItem;
  canReview: boolean;
  product?: "wallet" | "realprofit";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const isRealProfit = product === "realprofit";

  const chargeCurrency =
    intent.currency.toUpperCase() === "PEN" ? "PEN" : "USD";
  const feePercent = isRealProfit ? 0 : (intent.feePercent ?? 10);
  const fxRate = intent.fxRateUsdPen ?? 3.48;
  const defaultAmount =
    intent.detectedAmount != null && intent.detectedAmount > 0
      ? intent.detectedAmount
      : intent.amount;

  const [amountInput, setAmountInput] = useState(
    () => String(Math.round(defaultAmount * 100) / 100),
  );

  const parsedAmount = Number.parseFloat(amountInput.replace(",", "."));
  const quote = useMemo(() => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return null;
    if (isRealProfit) {
      return {
        grossChargeCents: Math.round(parsedAmount * 100),
        creditUsdCents: 0,
        feeUsdCents: 0,
        feePercent: 0,
        fxRateUsdPen: fxRate,
        grossUsdCents: Math.round(parsedAmount * 100),
        grossPenCents: 0,
        creditPenCents: 0,
        feePenCents: 0,
      };
    }
    return quoteFromGrossCharge({
      grossChargeCents: Math.round(parsedAmount * 100),
      chargeCurrency,
      feePercent,
      fxRateUsdPen: fxRate,
    });
  }, [parsedAmount, chargeCurrency, feePercent, fxRate, isRealProfit]);

  const showActions =
    canReview && intent.reviewStatus === "pending_review";

  async function handleApprove() {
    if (!quote) {
      setError("Ingresa un monto válido de la boleta.");
      return;
    }
    setBusy("approve");
    setError(null);
    try {
      await apiClient(`/api/payments/manual/${intent.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          adjustedGrossChargeCents: quote.grossChargeCents,
        }),
      });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo aprobar el comprobante.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    const reason = rejectReason.trim() || "Comprobante rechazado por revisión.";
    setBusy("reject");
    setError(null);
    try {
      await apiClient(`/api/payments/manual/${intent.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setRejectOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo rechazar el comprobante.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--auth-divider)] bg-[var(--auth-card,#fff)] shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="relative min-h-[200px] bg-[#0f172a]/[0.04]">
          {intent.proofSignedUrl ? (
            isImageMime(intent.proofMimeType, intent.proofFileName) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={intent.proofSignedUrl}
                alt={intent.proofFileName ?? "Comprobante"}
                className="h-full max-h-[320px] w-full object-contain object-center p-3"
              />
            ) : (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm font-semibold text-[var(--auth-text)]">
                  {intent.proofFileName ?? "Archivo adjunto"}
                </p>
                <a
                  href={intent.proofSignedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-[#ff781f] underline underline-offset-2"
                >
                  Abrir comprobante
                </a>
              </div>
            )
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center p-6 text-sm text-[var(--auth-muted)]">
              Sin preview del comprobante
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--auth-muted)]">
                {isRealProfit
                  ? "Real Profit COD · $20"
                  : intent.provider === "crypto"
                    ? "Cripto"
                    : "Transferencia BCP"}
              </p>
              <h3 className="mt-0.5 truncate text-base font-semibold text-[var(--auth-text)]">
                {intent.hecomClienteName?.trim() ||
                  intent.organizationName ||
                  "Cliente"}
              </h3>
              <p className="text-xs text-[var(--auth-muted)]">
                {intent.actorEmail ?? intent.actorName ?? "—"}
              </p>
              {intent.shopDomain ? (
                <p className="mt-0.5 font-mono text-[11px] text-[var(--auth-muted)]">
                  Tienda: {intent.shopDomain}
                </p>
              ) : null}
              {intent.hecomClienteName &&
              intent.organizationName &&
              intent.hecomClienteName.trim() !==
                intent.organizationName.trim() ? (
                <p className="mt-0.5 text-[11px] text-[var(--auth-muted)]">
                  Org: {intent.organizationName}
                </p>
              ) : null}
            </div>
            <Badge variant={reviewVariants[intent.reviewStatus]}>
              {reviewLabels[intent.reviewStatus]}
            </Badge>
          </div>

          <div className="rounded-xl bg-[#f8fafc] px-3 py-2.5">
            {showActions ? (
              <>
                <label className="text-xs font-medium text-[var(--auth-muted)]">
                  Monto real de la boleta ({chargeCurrency})
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full max-w-[11rem] rounded-lg border border-[var(--auth-divider)] bg-white px-3 py-2 text-lg font-bold tabular-nums text-[var(--auth-text)] outline-none focus:border-[#ff781f]"
                  />
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#ff781f] underline-offset-2 hover:underline"
                    onClick={() =>
                      setAmountInput(
                        String(Math.round(intent.amount * 100) / 100),
                      )
                    }
                  >
                    Usar esperado
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-[var(--auth-muted)]">
                  Esperado:{" "}
                  {chargeCurrency === "PEN"
                    ? formatPenAmount(Math.round(intent.amount * 100))
                    : formatMoney(intent.amount, "USD")}
                  {intent.detectedAmount != null
                    ? ` · OCR: ${
                        chargeCurrency === "PEN"
                          ? formatPenAmount(
                              Math.round(intent.detectedAmount * 100),
                            )
                          : formatMoney(intent.detectedAmount, "USD")
                      }`
                    : ""}
                </p>
                <div className="mt-2 space-y-0.5 text-xs text-[var(--auth-muted)]">
                  {isRealProfit ? (
                    <p>
                      Al aceptar:{" "}
                      <span className="font-semibold text-[var(--auth-text)]">
                        activa Real Profit COD + vincula tienda
                      </span>
                      {" "}
                      (no acredita cartera ads).
                    </p>
                  ) : (
                    <>
                      <p>
                        Acredita a cartera:{" "}
                        <span className="font-semibold text-[var(--auth-text)]">
                          {quote
                            ? formatMoney(quote.creditUsdCents / 100, "USD")
                            : "—"}
                        </span>
                      </p>
                      <p>
                        Fee {feePercent}%:{" "}
                        <span className="font-semibold text-[var(--auth-text)]">
                          {quote
                            ? chargeCurrency === "PEN" &&
                              quote.feePenCents != null
                              ? formatPenAmount(quote.feePenCents)
                              : formatMoney(quote.feeUsdCents / 100, "USD")
                            : "—"}
                        </span>
                      </p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-[var(--auth-muted)]">Monto cargado</p>
                <p className="text-lg font-bold tabular-nums text-[var(--auth-text)]">
                  {formatMoney(intent.amount, intent.currency)}
                </p>
                <div className="mt-1 space-y-0.5 text-xs text-[var(--auth-muted)]">
                  {intent.creditUsd != null ? (
                    <p>
                      Acredita a cartera:{" "}
                      <span className="font-semibold text-[var(--auth-text)]">
                        {formatMoney(intent.creditUsd, "USD")}
                      </span>
                    </p>
                  ) : null}
                  {intent.feePercent != null ? (
                    <p>
                      Fee:{" "}
                      <span className="font-semibold text-[var(--auth-text)]">
                        {intent.feePercent}%
                      </span>
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <p className="text-xs text-[var(--auth-muted)]">
            {new Date(intent.createdAt).toLocaleString("es-PE")}
            {intent.proofFileName ? ` · ${intent.proofFileName}` : ""}
            {" · "}
            <span className="font-mono text-[11px]">
              {intent.id.slice(0, 8)}
            </span>
          </p>

          {intent.analysisReason ? (
            <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {intent.analysisReason}
            </p>
          ) : null}

          {intent.failureReason && intent.reviewStatus === "rejected" ? (
            <p className="text-xs text-red-700">{intent.failureReason}</p>
          ) : null}

          {error ? (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {showActions ? (
            <div className="mt-auto space-y-2 border-t border-[var(--auth-divider)] pt-3">
              <p className="text-[11px] text-[var(--auth-muted)]">
                Revisa el monto de la boleta, ajústalo si es necesario y luego
                acepta. El saldo se acredita en la cartera y el registro pasa a Lo pagado.
              </p>
              {!rejectOpen ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="success"
                    size="sm"
                    disabled={busy !== null || !quote}
                    onClick={() => void handleApprove()}
                  >
                    {busy === "approve" ? "Acreditando…" : "Aceptar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => setRejectOpen(true)}
                  >
                    Rechazar
                  </Button>
                  {intent.proofSignedUrl ? (
                    <a
                      href={intent.proofSignedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center px-2 text-xs font-semibold text-[#ff781f] underline-offset-2 hover:underline"
                    >
                      Ver original
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Motivo visible para el cliente…"
                    className="w-full rounded-lg border border-[var(--auth-divider)] bg-white px-3 py-2 text-sm outline-none focus:border-[#ff781f]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void handleReject()}
                    >
                      {busy === "reject" ? "Rechazando…" : "Confirmar rechazo"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => setRejectOpen(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

interface ManualVoucherReviewSectionProps {
  pending: ManualPaymentIntentItem[];
  recent: ManualPaymentIntentItem[];
  pendingCount: number;
  canReview: boolean;
  /** Cliente: solo sus vouchers (lista plana). */
  clientItems?: ManualPaymentIntentItem[];
  mode: "staff" | "client";
  /** Cola de todos los clientes (copy de gerente). */
  globalQueue?: boolean;
  /** wallet = recarga cartera; realprofit = +$20 COD */
  product?: "wallet" | "realprofit";
}

export function ManualVoucherReviewSection({
  pending,
  recent,
  pendingCount,
  canReview,
  clientItems,
  mode,
  globalQueue = false,
  product = "wallet",
}: ManualVoucherReviewSectionProps) {
  if (mode === "client") {
    const items = clientItems ?? [];
    if (items.length === 0) return null;
    return (
      <section
        id="comprobantes"
        className="space-y-4"
        aria-label="Tus comprobantes"
      >
        <div>
          <h2 className="text-base font-semibold text-[var(--auth-text)]">
            Tus comprobantes
          </h2>
          <p className="mt-1 text-sm text-[var(--auth-muted)]">
            Seguimiento de transferencias. Si está en revisión, te avisamos
            cuando se acredite el saldo.
          </p>
        </div>
        <div className="space-y-4">
          {items.map((intent) => (
            <VoucherCard
              key={intent.id}
              intent={intent}
              canReview={false}
              product={product}
            />
          ))}
        </div>
      </section>
    );
  }

  if (pending.length === 0) return null;

  const isRealProfit = product === "realprofit";

  return (
    <section
      id="comprobantes"
      className="space-y-5"
      aria-label="Revisión de comprobantes"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-[var(--auth-text)]">
              {isRealProfit
                ? globalQueue
                  ? "Pagos Profit pendientes"
                  : "Pendientes Profit"
                : globalQueue
                  ? "Pagos manuales pendientes"
                  : "Pendientes"}
            </h2>
            {pendingCount > 0 ? (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-500 px-2 text-xs font-bold text-white">
                {pendingCount}
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--auth-muted)]">
            {isRealProfit
              ? "Depósitos Real Profit COD $20 por aceptar o rechazar"
              : "Solo boletas BCP por aceptar o rechazar"}
            {globalQueue ? " · todos los clientes · más antiguos primero" : ""}.
            {isRealProfit
              ? " Al aceptar se activa COD y se vincula la tienda (sin cartera ads)."
              : " Edita el monto de la boleta si no coincide y luego acepta."}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {pending.map((intent) => (
          <VoucherCard
            key={intent.id}
            intent={intent}
            canReview={canReview}
            product={product}
          />
        ))}
      </div>
    </section>
  );
}
