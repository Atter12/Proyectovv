import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import { PaymentsMoneyFlowGuide } from "./PaymentsMoneyFlowGuide";
import type { PaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

interface PaymentsPageHeroProps {
  cliente: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  capabilities: PaymentsFundingCapabilities;
  introCopy: string;
}

/**
 * Hero Pagos — Rockads + naranja Holistic.
 * Sin link a /clientes.
 */
export function PaymentsPageHero({
  cliente,
  capabilities,
  introCopy,
}: PaymentsPageHeroProps) {
  const title =
    capabilities.canAgencyBmFund && !capabilities.canClientStripeFund
      ? "Fondear ads desde BM"
      : "Recargar y fondear ads";

  const eyebrow = capabilities.canSwitchFundingModes
    ? "Cartera Holistic · vs · TikTok Ads"
    : capabilities.canAgencyBmFund
      ? "Gerente · Cash BM TikTok"
      : "Cliente · Cartera Holistic";

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="overview-hero relative overflow-hidden rounded-[1.5rem] border border-[rgb(20_18_16_/_0.06)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(255_120_31_/_0.18),transparent_55%),radial-gradient(90%_70%_at_100%_10%,rgb(255_161_44_/_0.12),transparent_50%),linear-gradient(165deg,#fff8f3_0%,#ffffff_42%,#fff4ec_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-[-20%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgb(255_120_31_/_0.22),transparent_68%)] blur-2xl"
        />
        <div
          aria-hidden
          className="overview-hero-grid pointer-events-none absolute inset-0 opacity-[0.35]"
        />

        <div className="relative grid gap-8 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.75fr)] lg:items-center lg:gap-10 lg:px-10 lg:py-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <HecomClienteAvatar
                name={cliente.name}
                avatarUrl={cliente.avatarUrl}
                size="lg"
                className="ring-2 ring-white/90 shadow-[0_14px_36px_rgb(255_120_31_/_0.22)]"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--auth-accent)]">
                  {siteConfig.name}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-[var(--auth-text-muted)]">
                  {eyebrow} · {cliente.name}
                </p>
              </div>
            </div>

            <h1 className="font-display mt-3 text-[2rem] font-semibold leading-[1.1] tracking-[-0.04em] text-[var(--auth-text)] sm:text-[2.35rem]">
              {title}
            </h1>
            <p className="mt-3 max-w-xl text-[15px] font-medium leading-6 text-[var(--auth-text-muted)] sm:text-[16px] sm:leading-7">
              {introCopy}
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <a
                href="#asignar-saldo"
                className="inline-flex h-11 items-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.3)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
              >
                Ir a asignar
              </a>
              <Link
                href={routes.adAccounts}
                className="inline-flex h-11 items-center rounded-xl border border-[rgb(20_18_16_/_0.1)] bg-white/80 px-5 text-[14px] font-semibold text-[var(--auth-text)] backdrop-blur-sm transition-colors hover:bg-white"
              >
                Ver cuentas
              </Link>
            </div>
          </div>

          <div className="overview-hero-balance relative mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
            <div className="relative overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/75 p-5 shadow-[0_20px_50px_rgb(255_120_31_/_0.12)] backdrop-blur-md sm:p-6">
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#ff781f,#ffa12c,#ff781f)]"
              />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-text-soft)]">
                Flujo
              </p>
              <p className="mt-2 font-display text-[1.35rem] font-semibold leading-snug tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.5rem]">
                {capabilities.canAgencyBmFund && !capabilities.canClientStripeFund
                  ? "BM → cuenta ads"
                  : capabilities.canSwitchFundingModes
                    ? "Stripe o BM → ads"
                    : "Stripe → cartera → ads"}
              </p>
              <p className="mt-3 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                {capabilities.canAgencyBmFund && !capabilities.canClientStripeFund
                  ? `Fondeá la cuenta ads de ${cliente.name} con cash del Business Center.`
                  : `Recargás arriba; abajo ves cobros y gastos Hecom de ${cliente.name}.`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {capabilities.canClientStripeFund ? <PaymentsMoneyFlowGuide /> : null}
    </div>
  );
}
