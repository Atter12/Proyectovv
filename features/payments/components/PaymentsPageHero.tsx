import Link from "next/link";
import { routes } from "@/config/routes";
import { formatMoney } from "@/lib/format-money";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import { PaymentsMoneyFlowGuide } from "./PaymentsMoneyFlowGuide";
import type { HecomFinanceSnapshot } from "@/features/payments/types/hecom-finance-snapshot";
import type { PaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

interface PaymentsPageHeroProps {
  cliente: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  capabilities: PaymentsFundingCapabilities;
  introCopy: string;
  hecomFinance?: HecomFinanceSnapshot | null;
}

/**
 * Cabecera de Pagos — clara, compacta, con badge de persona + saldo Hecom.
 */
export function PaymentsPageHero({
  cliente,
  capabilities,
  introCopy,
  hecomFinance = null,
}: PaymentsPageHeroProps) {
  const persona =
    capabilities.canSwitchFundingModes
      ? "super_admin"
      : capabilities.canAgencyBmFund && !capabilities.canClientStripeFund
        ? "gerente"
        : "cliente";

  const title =
    persona === "gerente"
      ? "Fondear ads desde BM"
      : persona === "super_admin"
        ? "Pagos y fondeo"
        : "Recargar y asignar";

  const modeLabel =
    persona === "super_admin"
      ? "Super admin · Stripe o BM"
      : persona === "gerente"
        ? "Gerente · Cash BM"
        : "Cliente · Cartera Holistic";

  const flowLabel =
    persona === "gerente"
      ? "BM → cuenta ads"
      : persona === "super_admin"
        ? "Stripe o BM → ads"
        : "Stripe → cartera → ads";

  const debt = hecomFinance != null && hecomFinance.saldoEstimado < 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="dashboard-surface-card overflow-hidden rounded-[1rem]">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <HecomClienteAvatar
                name={cliente.name}
                avatarUrl={cliente.avatarUrl}
                size="md"
              />
              <div className="min-w-0">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
                  Pagos
                </p>
                <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--auth-text-muted)]">
                  {cliente.name}
                </p>
              </div>
              <span className="dashboard-role-badge" data-role={persona}>
                {persona === "super_admin"
                  ? "Super admin"
                  : persona === "gerente"
                    ? "Gerente"
                    : "Cliente"}
              </span>
            </div>

            <h1 className="mt-3 text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.65rem]">
              {title}
            </h1>
            <p className="mt-2 max-w-xl text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
              {introCopy}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="#asignar-saldo"
                className="inline-flex h-10 items-center rounded-lg bg-[var(--auth-accent)] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
              >
                Ir a asignar
              </a>
              <Link
                href={routes.adAccounts}
                className="inline-flex h-10 items-center rounded-lg border border-[var(--auth-border)] bg-white px-4 text-[13px] font-semibold text-[var(--auth-text)] transition-colors hover:border-[var(--auth-accent)] hover:text-[var(--auth-accent)]"
              >
                Ver cuentas
              </Link>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-3 lg:min-w-[240px]">
            {hecomFinance != null ? (
              <div className="rounded-[1rem] border border-[var(--auth-border)] bg-[var(--auth-bg)] p-4">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
                  {debt ? "Deuda neta Hecom" : "Saldo estimado Hecom"}
                </p>
                <p
                  className={`mt-1.5 text-[1.75rem] font-bold leading-none tracking-[-0.04em] tabular-nums ${
                    debt ? "text-[#b45309]" : "text-[var(--auth-text)]"
                  }`}
                >
                  {formatMoney(hecomFinance.saldoEstimado, "USD")}
                </p>
                <p className="mt-2 text-[11px] leading-4 text-[var(--auth-text-muted)]">
                  Cobros {formatMoney(hecomFinance.cobroTotal, "USD")} · Gastos{" "}
                  {formatMoney(hecomFinance.gastoTotal, "USD")} · Fees{" "}
                  {formatMoney(hecomFinance.feeTotal, "USD")}
                </p>
                <p className="mt-3 inline-flex items-center rounded-full border border-[var(--auth-accent)]/30 bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--auth-accent)]">
                  Fee Hecom {hecomFinance.depositFeePercent}% · querés X → cobrás X+fee
                </p>
              </div>
            ) : null}

            <div className="rounded-[1rem] border border-[var(--auth-border)] bg-white p-4">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
                Modo activo
              </p>
              <p className="mt-1.5 text-[15px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                {modeLabel}
              </p>
              <p className="mt-2 text-[12px] font-semibold text-[var(--auth-accent)]">
                {flowLabel}
              </p>
              <p className="mt-2 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                {persona === "gerente"
                  ? "Cash del Business Center directo a la cuenta ads. El historial de abajo no baja con fondeo BM."
                  : "Recargá arriba; el historial Hecom está abajo."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {capabilities.canClientStripeFund ? (
        <PaymentsMoneyFlowGuide
          feePercent={hecomFinance?.depositFeePercent ?? 10}
        />
      ) : null}
    </div>
  );
}
