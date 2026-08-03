import Link from "next/link";
import { routes } from "@/config/routes";

/**
 * Guía de las 2 bolsas de dinero (no son 2 pasarelas de pago).
 * Holistic = contabilidad/pago del cliente · TikTok Ads = donde se gasta la pauta.
 */
export function PaymentsMoneyFlowGuide() {
  return (
    <div className="rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-[#faf7f3] px-4 py-3.5 sm:px-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#8a5a38]">
        Dos bolsas de plata (importante)
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[rgb(20_18_16_/_0.06)] bg-white/70 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a5a38]">
            A · Cartera Holistic
          </p>
          <p className="mt-1 text-[13px] font-medium text-[#1a1612]">
            Pagar / recargar acá
          </p>
          <p className="mt-0.5 text-[12px] leading-4 text-[#6b645c]">
            Stripe, manual o cripto. Es el saldo del cliente en este panel
            (contabilidad Holistic).
          </p>
        </div>

        <div className="rounded-lg border border-[rgb(20_18_16_/_0.06)] bg-white/70 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a5a38]">
            B · Saldo en TikTok Ads
          </p>
          <p className="mt-1 text-[13px] font-medium text-[#1a1612]">
            Donde gastan las campañas
          </p>
          <p className="mt-0.5 text-[12px] leading-4 text-[#6b645c]">
            Si la cuenta ads ya tiene saldo, puede seguir pautando sin Stripe.
            Para meter más presupuesto controlado: Recargar → Asignar.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#7a736a]">
        <span className="font-medium text-[#2a241f]">Puente:</span>
        <span>Recargar cartera</span>
        <span aria-hidden className="text-[#c4bbb0]">
          →
        </span>
        <a
          href="#asignar-saldo"
          className="font-medium text-[#c45a18] underline-offset-2 hover:underline"
        >
          Asignar a cuenta ads
        </a>
        <span aria-hidden className="text-[#c4bbb0]">
          →
        </span>
        <span>TikTok gasta</span>
        <span className="text-[#c4bbb0]">·</span>
        <Link
          href={routes.adAccounts}
          className="font-medium text-[#c45a18] underline-offset-2 hover:underline"
        >
          ver cuentas
        </Link>
      </div>
    </div>
  );
}
