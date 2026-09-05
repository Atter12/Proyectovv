"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format-money";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { ManualPaymentIntentItem } from "@/services/payments.service";

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
}: {
  intent: ManualPaymentIntentItem;
  canReview: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const showActions =
    canReview && intent.reviewStatus === "pending_review";

  async function handleApprove() {
    setBusy("approve");
    setError(null);
    try {
      await apiClient(`/api/payments/manual/${intent.id}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
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
                {intent.provider === "crypto" ? "Cripto" : "Transferencia BCP"}
              </p>
              <h3 className="mt-0.5 truncate text-base font-semibold text-[var(--auth-text)]">
                {intent.hecomClienteName?.trim() ||
                  intent.organizationName ||
                  "Cliente"}
              </h3>
              <p className="text-xs text-[var(--auth-muted)]">
                {intent.actorEmail ?? intent.actorName ?? "—"}
              </p>
              {intent.hecomClienteName &&
              intent.organizationName &&
              intent.hecomClienteName.trim() !== intent.organizationName.trim() ? (
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
                Al aceptar se acredita saldo disponible. El cliente asigna a
                TikTok cuando quiera.
              </p>
              {!rejectOpen ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="success"
                    size="sm"
                    disabled={busy !== null}
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
}

export function ManualVoucherReviewSection({
  pending,
  recent,
  pendingCount,
  canReview,
  clientItems,
  mode,
  globalQueue = false,
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
            <VoucherCard key={intent.id} intent={intent} canReview={false} />
          ))}
        </div>
      </section>
    );
  }

  if (pending.length === 0 && recent.length === 0) return null;

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
              {globalQueue ? "Cola global de boletas" : "Cola de boletas"}
            </h2>
            {pendingCount > 0 ? (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-500 px-2 text-xs font-bold text-white">
                {pendingCount}
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--auth-muted)]">
            {globalQueue
              ? "Todos los clientes · pendientes más viejos primero. Al aceptar se acredita "
              : "Revisá boletas en cola. Al aceptar se acredita "}
            <strong className="font-semibold text-[var(--auth-text)]">
              saldo disponible
            </strong>{" "}
            — el cliente asigna a su cuenta después.
          </p>
        </div>
      </div>

      {pending.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            En revisión
          </h3>
          <div className="space-y-4">
            {pending.map((intent) => (
              <VoucherCard
                key={intent.id}
                intent={intent}
                canReview={canReview}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--auth-divider)] px-4 py-8 text-center text-sm text-[var(--auth-muted)]">
          No hay comprobantes pendientes.
        </div>
      )}

      {recent.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--auth-muted)]">
            Recientes
          </h3>
          <div className="space-y-4">
            {recent.map((intent) => (
              <VoucherCard key={intent.id} intent={intent} canReview={false} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
