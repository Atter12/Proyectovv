import Link from "next/link";
import { routes } from "@/config/routes";

/**
 * Guía de las 2 bolsas — estilo Rockads tiles + naranja Holistic.
 */
export function PaymentsMoneyFlowGuide() {
  return (
    <section aria-labelledby="money-flow-heading">
      <div className="mb-4 max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
          Dos bolsas de plata
        </p>
        <h2
          id="money-flow-heading"
          className="font-display mt-1.5 text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.5rem]"
        >
          No son dos pasarelas: son dos lugares
        </h2>
        <p className="mt-1.5 text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
          Holistic = contabilidad. TikTok Ads = donde gasta la pauta.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="group relative overflow-hidden rounded-[1.2rem] border border-[rgb(20_18_16_/_0.08)] bg-white p-5 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
          <div
            aria-hidden
            className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[rgb(255_120_31_/_0.08)]"
          />
          <p className="relative text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
            A · Cartera Holistic
          </p>
          <p className="relative mt-2 text-[15px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
            Pagar / recargar acá
          </p>
          <p className="relative mt-1 text-[13px] leading-5 text-[var(--auth-text-muted)]">
            Stripe, manual o cripto. Saldo del cliente en este panel.
          </p>
        </div>

        <div className="group relative overflow-hidden rounded-[1.2rem] border border-[rgb(20_18_16_/_0.08)] bg-white p-5 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
          <div
            aria-hidden
            className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[rgb(255_120_31_/_0.08)]"
          />
          <p className="relative text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
            B · Saldo TikTok Ads
          </p>
          <p className="relative mt-2 text-[15px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
            Donde gastan las campañas
          </p>
          <p className="relative mt-1 text-[13px] leading-5 text-[var(--auth-text-muted)]">
            Para meter más presupuesto: recargar → asignar a la cuenta.
          </p>
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--auth-text-muted)]">
        <span className="font-semibold text-[var(--auth-text)]">Puente:</span>
        <span>Recargar cartera</span>
        <span aria-hidden className="text-[var(--auth-text-soft)]">
          →
        </span>
        <a
          href="#asignar-saldo"
          className="font-bold text-[var(--auth-accent)] underline-offset-2 hover:underline"
        >
          Asignar a cuenta ads
        </a>
        <span aria-hidden className="text-[var(--auth-text-soft)]">
          →
        </span>
        <span>TikTok gasta</span>
        <span className="text-[var(--auth-text-soft)]">·</span>
        <Link
          href={routes.adAccounts}
          className="font-bold text-[var(--auth-accent)] underline-offset-2 hover:underline"
        >
          ver cuentas
        </Link>
      </p>
    </section>
  );
}
