import { routes } from "@/config/routes";
import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import {
  CrmAsideStat,
  CrmHeroButton,
  CrmMetricCell,
  CrmMetricsStrip,
  CrmScopeHero,
} from "@/components/dashboard/crm-ui";
import { AdAccountsOpenCreateModalButton } from "./AdAccountsOpenCreateModalButton.client";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsPageHeaderProps {
  summary: AdAccountsSummary;
  hecomScoped?: boolean;
  clienteName?: string;
  clienteId?: string;
  avatarUrl?: string | null;
  hideCreate?: boolean;
}

export function AdAccountsPageHeader({
  summary,
  hecomScoped = false,
  clienteName,
  avatarUrl,
  hideCreate = false,
}: AdAccountsPageHeaderProps) {
  return (
    <div className="space-y-5">
      <CrmScopeHero
        module="Cuentas ads"
        title="Mis cuentas publicitarias"
        cliente={
          hecomScoped && clienteName
            ? { name: clienteName, avatarUrl }
            : undefined
        }
        meta={
          hecomScoped
            ? "TikTok · solo lectura"
            : "Seleccioná un cliente para ver sus advertisers"
        }
        actions={
          <>
            <CrmHeroButton href={routes.payments}>Ir a pagos</CrmHeroButton>
            <CrmHeroButton href={routes.overview} variant="secondary">
              Resumen
            </CrmHeroButton>
            {hideCreate ? null : (
              <AdAccountsOpenCreateModalButton className="inline-flex h-10 items-center rounded-lg border border-[var(--auth-border)] bg-white px-4 text-[13px] font-semibold text-[var(--auth-text)]">
                Crear cuenta
              </AdAccountsOpenCreateModalButton>
            )}
          </>
        }
        aside={
          <CrmAsideStat
            label="Saldo asignado"
            value={formatMoney(summary.assignedBalance)}
            detail={
              <>
                {formatNumber(summary.activeAccounts)} activa
                {summary.activeAccounts === 1 ? "" : "s"}
                {(summary.disabledAccounts ?? 0) > 0
                  ? ` · ${formatNumber(summary.disabledAccounts ?? 0)} suspendida${
                      (summary.disabledAccounts ?? 0) === 1 ? "" : "s"
                    }`
                  : ""}{" "}
                · {formatNumber(summary.totalAccounts)} total
              </>
            }
          />
        }
      />

      <CrmMetricsStrip>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:divide-x sm:divide-[var(--auth-divider)]">
          <CrmMetricCell
            label="Totales"
            value={formatNumber(summary.totalAccounts)}
            emphasis="muted"
          />
          <CrmMetricCell
            className="border-r border-[var(--auth-divider)] sm:border-r-0"
            label="Activas"
            value={formatNumber(summary.activeAccounts)}
            emphasis="primary"
          />
          <CrmMetricCell
            className="border-b border-[var(--auth-divider)] sm:border-b-0"
            label="Saldo"
            value={formatMoney(summary.assignedBalance)}
          />
          <CrmMetricCell
            label="Suspendidas"
            value={formatNumber(summary.disabledAccounts ?? 0)}
            emphasis="muted"
          />
        </div>
      </CrmMetricsStrip>
    </div>
  );
}
