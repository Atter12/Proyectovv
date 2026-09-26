"use client";

import { useMemo, useState } from "react";
import { MissingCobroClaimPanel } from "@/features/clientes/components/MissingCobroClaimPanel.client";
import { ManualPaymentModal } from "@/features/payments/components/ManualPaymentModal.client";
import { listRecentPeriodos } from "@/lib/payments/missing-cobro.shared";
import type { ManualPaymentIntentItem } from "@/services/payments.service";

type Activity = {
  id: string;
  createdAt: string;
  amount: number;
  currency: string;
  reviewStatus: string;
  kind: "manual" | "missing_cobro";
  periodoResumen: string | null;
};

function money(amount: number, currency: string): string {
  const code = currency.toUpperCase() === "PEN" ? "PEN" : "USD";
  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending_review":
      return "En revisión";
    case "approved":
      return "Aprobado";
    case "rejected":
      return "Rechazado";
    default:
      return "Falta voucher";
  }
}

function activityDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "America/Lima",
  }).format(date);
}

export function PublicLoPagadoActions({
  apiBase,
  claims,
  activity,
  month,
  presentation = "default",
  debtAmountUsd,
  activityUnavailable = false,
}: {
  apiBase: string;
  claims: ManualPaymentIntentItem[];
  activity: Activity[];
  /** YYYY-MM del link. La boleta faltante solo se reporta de este mes. */
  month: string;
  presentation?: "default" | "portal";
  /** Referencia visual del saldo del mes; el servidor valida cada pago. */
  debtAmountUsd?: number;
  activityUnavailable?: boolean;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const periodos = useMemo(
    () => (month && /^\d{4}-\d{2}$/.test(month) ? [month] : listRecentPeriodos(1)),
    [month],
  );
  const isPortal = presentation === "portal";
  const noDebt =
    typeof debtAmountUsd === "number" &&
    Number.isFinite(debtAmountUsd) &&
    debtAmountUsd <= 0;
  const manuals = activity
    .filter(
      (row) =>
        row.kind === "manual" &&
        (!isPortal || row.periodoResumen === month),
    )
    .slice(0, 6);
  const endpoints = useMemo(
    () => ({
      config: `${apiBase}/config`,
      create: `${apiBase}/manual`,
      proof: (id: string) => `${apiBase}/proof/${id}`,
      claims: `${apiBase}/missing-cobro`,
    }),
    [apiBase],
  );

  const claimPanel = (
    <MissingCobroClaimPanel
      presentation={presentation}
      periodos={periodos}
      initialClaims={claims}
      endpoints={{
        claims: endpoints.claims,
        proof: endpoints.proof,
      }}
    />
  );

  return (
    <div className="space-y-4">
      {isPortal ? (
        <section className="space-y-5">
          <div>
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              disabled={noDebt}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#c2410c] px-5 py-3 text-sm font-semibold text-white transition-colors enabled:hover:bg-[#9a3412] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-surface)] disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-hover)] disabled:text-[var(--admin-text-muted)]"
            >
              {noDebt ? "Sin deuda pendiente" : "Pagar ahora"}
            </button>
            <p className="mt-3 text-[13px] leading-5 text-[var(--admin-text-muted)]">
              {noDebt
                ? "No tienes un saldo pendiente en este mes. Puedes revisar tus pagos más abajo."
                : "Elige un método de transferencia y envía tu comprobante. Tu pago se aplica cuando el equipo lo revisa y aprueba."}
            </p>
          </div>

          {activityUnavailable ? (
            <p role="status" className="rounded-lg bg-[var(--admin-badge-warning-bg)] p-3 text-[13px] leading-5 text-[var(--admin-badge-warning-text)]">
              No pudimos cargar el estado de tus envíos. Actualiza la página antes
              de volver a enviar un comprobante.
            </p>
          ) : null}

          {manuals.length > 0 ? (
            <div className="border-t border-[var(--admin-border)] pt-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)]">
                Pagos enviados este mes
              </h3>
              <ul className="mt-2 divide-y divide-[var(--admin-border)]">
                {manuals.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-[13px]"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold tabular-nums text-[var(--admin-text)]">
                        {money(row.amount, row.currency)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--admin-text-muted)]">
                        <time dateTime={row.createdAt}>
                          {activityDate(row.createdAt)}
                        </time>
                        {" · Ref. "}
                        <span title={row.id}>
                          {row.id.slice(0, 8).toUpperCase()}
                        </span>
                      </p>
                    </div>
                    <span className="text-xs font-medium leading-5 text-[var(--admin-text-muted)]">
                      {row.reviewStatus === "awaiting_proof"
                        ? "Falta comprobante"
                        : statusLabel(row.reviewStatus)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="relative overflow-hidden rounded-2xl border border-[#ffd7b8] bg-gradient-to-br from-[#fff8f1] via-white to-[#f7f4ef] p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">
            Pagos
          </p>
          <h2 className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em] text-[#1a1714]">
            Pago manual
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[#5c564e]">
            Paga lo que debes de este mes. Eliges el monto, transfieres y subes
            el voucher. Gerencia lo ve en Pagos manuales como pago de deuda: baja
            lo que debes y no recarga cartera.
          </p>
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="mt-4 inline-flex h-10 items-center rounded-[10px] bg-[#c2410c] px-4 text-[13px] font-semibold text-white hover:bg-[#9a3412]"
          >
            Pagar y subir voucher
          </button>
          {manuals.length > 0 ? (
            <ul className="mt-4 divide-y divide-[#f0e6dc] rounded-xl border border-[#f0e6dc] bg-white">
              {manuals.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-[12px]"
                >
                  <span className="font-semibold tabular-nums text-[#1a1714]">
                    {money(row.amount, row.currency)}
                  </span>
                  <span className="text-[#78716c]">{statusLabel(row.reviewStatus)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      )}

      {isPortal ? (
        <details className="border-t border-[var(--admin-border)] pt-1">
          <summary className="cursor-pointer rounded-lg py-3 text-sm font-semibold text-[var(--admin-text)] marker:text-[var(--admin-text-muted)] hover:text-[var(--admin-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-surface)]">
            Ya pagué y no aparece
          </summary>
          <div className="pb-2 pt-1">{claimPanel}</div>
        </details>
      ) : (
        claimPanel
      )}

      <ManualPaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        paysDebt
        debtMonth={month}
        initialDebtAmountUsd={isPortal ? debtAmountUsd : undefined}
        endpoints={{
          config: endpoints.config,
          create: endpoints.create,
          proof: endpoints.proof,
        }}
      />
    </div>
  );
}
