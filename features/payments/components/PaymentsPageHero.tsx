import { routes } from "@/config/routes";
import { formatMoney } from "@/lib/format-money";
import {
  CrmAsideStat,
  CrmHeroButton,
  CrmScopeHero,
} from "@/components/dashboard/crm-ui";
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
      ? "Recargar ads desde BM"
      : persona === "super_admin"
        ? "Pagos y recargas"
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
      <CrmScopeHero
        module="Pagos"
        title={title}
        cliente={{ name: cliente.name, avatarUrl: cliente.avatarUrl }}
        meta={modeLabel}
        badge={
          <span className="dashboard-role-badge" data-role={persona}>
            {persona === "super_admin"
              ? "Super admin"
              : persona === "gerente"
                ? "Gerente"
                : "Cliente"}
          </span>
        }
        actions={
          <>
            <CrmHeroButton href={`${routes.payments}#asignar-saldo`}>
              Ir a asignar
            </CrmHeroButton>
            <CrmHeroButton href={routes.adAccounts} variant="secondary">
              Ver cuentas
            </CrmHeroButton>
          </>
        }
        aside={
          <div className="space-y-4">
            {hecomFinance != null ? (
              <CrmAsideStat
                label={debt ? "Deuda neta Hecom" : "Saldo estimado Hecom"}
                value={formatMoney(hecomFinance.saldoEstimado, "USD")}
                valueClassName={debt ? "text-[#b45309]" : "text-[var(--auth-text)]"}
                detail={
                  <>
                    {formatMoney(hecomFinance.cobroTotal, "USD")} cobros ·{" "}
                    {formatMoney(hecomFinance.gastoTotal, "USD")} gastos · Fee{" "}
                    {hecomFinance.depositFeePercent}%
                  </>
                }
              />
            ) : null}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
                Flujo activo
              </p>
              <p className="mt-1 text-[14px] font-semibold text-[var(--auth-text)]">
                {flowLabel}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                {introCopy}
              </p>
            </div>
          </div>
        }
      />

      {capabilities.canClientStripeFund ? (
        <PaymentsMoneyFlowGuide
          feePercent={hecomFinance?.depositFeePercent ?? 10}
        />
      ) : null}
    </div>
  );
}
