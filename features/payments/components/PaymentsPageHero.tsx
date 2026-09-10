import { getTranslations } from "next-intl/server";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
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

export async function PaymentsPageHero({
  cliente,
  capabilities,
  introCopy,
}: PaymentsPageHeroProps) {
  const t = await getTranslations("payments");
  const managerOnly =
    capabilities.canAgencyBmFund && !capabilities.canClientStripeFund;

  return (
    <header className="flex flex-col gap-5 border-b border-[var(--auth-divider)] pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <HecomClienteAvatar
            name={cliente.name}
            avatarUrl={cliente.avatarUrl}
            size="md"
            className="ring-1 ring-[var(--auth-border)]"
          />
          <p className="truncate text-[13px] font-medium text-[var(--auth-text-muted)]">
            {t("hero.ofClient", { name: cliente.name })}
          </p>
        </div>
        <h1 className="mt-4 text-[1.8rem] font-semibold leading-tight tracking-[-0.035em] text-[var(--auth-text)] sm:text-[2.15rem]">
          {managerOnly ? t("hero.titleManager") : t("hero.titleClient")}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[var(--auth-text-muted)]">
          {introCopy}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        {/*
         * Lleva al selector de método en vez de abrir el modal directo: el modal
         * hereda el método ya elegido, así que abrirlo desde acá metía a todos
         * por Stripe aunque quisieran pagar con Yape.
         */}
        {capabilities.canClientStripeFund ? (
          <a
            href="#recargar-saldo"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.2)] transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/35 focus-visible:ring-offset-2"
          >
            {t("hero.ctaReload")}
          </a>
        ) : null}
        <a
          href="#asignar-saldo"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--auth-border)] bg-white px-5 text-[14px] font-semibold text-[var(--auth-text)] transition-[background-color,transform] hover:bg-[var(--auth-bg)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/35 focus-visible:ring-offset-2"
        >
          {managerOnly ? t("hero.ctaPickAccount") : t("hero.ctaAssign")}
        </a>
      </div>
    </header>
  );
}
