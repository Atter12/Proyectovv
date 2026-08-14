import Link from "next/link";
import { routes } from "@/config/routes";
import { formatFeePercentLabel } from "@/lib/payments/deposit-fee";

/** Guía corta de cartera Holistic vs saldo TikTok — light. */
export function PaymentsMoneyFlowGuide({
  feePercent = 10,
}: {
  feePercent?: number;
}) {
  const feeLabel = formatFeePercentLabel(feePercent);

  return (
    <section className="dashboard-surface-card rounded-[1rem] p-4 sm:p-5">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
        Cómo fluye el dinero
      </p>
      <p className="mt-2 text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
        Fee de este cliente (Hecom Club):{" "}
        <span className="font-bold text-[var(--auth-text)]">{feeLabel}</span>.
        Si querés $100 con fee 10%, se cobran $110 y a la cartera llegan $100.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Step
          n="1"
          title="Recargar cartera"
          body={`Indicás el neto. Holistic suma el fee ${feeLabel} y cobra el bruto.`}
        />
        <Step n="2" title="Asignar a ads" body="Saldo de cartera → cuenta TikTok." />
        <Step n="3" title="Campañas gastan" body="El spend ocurre en el advertiser." />
      </div>
      <p className="mt-3 text-[12px] font-medium text-[var(--auth-text-muted)]">
        <a
          href="#asignar-saldo"
          className="font-semibold text-[var(--auth-accent)] hover:underline"
        >
          Ir a asignar
        </a>
        {" · "}
        <Link
          href={routes.adAccounts}
          className="font-semibold text-[var(--auth-accent)] hover:underline"
        >
          Ver cuentas
        </Link>
      </p>
    </section>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-[var(--auth-border)] bg-[var(--auth-bg)] p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--auth-accent)] text-[11px] font-bold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-[var(--auth-text)]">{title}</p>
        <p className="mt-0.5 text-[12px] leading-5 text-[var(--auth-text-muted)]">
          {body}
        </p>
      </div>
    </div>
  );
}
