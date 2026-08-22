import { routes } from "@/config/routes";
import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import {
  CrmAsideStat,
  CrmHeroButton,
  CrmMetricRow,
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

function accountStatusHint(summary: AdAccountsSummary) {
  const total = summary.totalAccounts;
  const active = summary.activeAccounts;
  const suspended = summary.disabledAccounts ?? 0;
  const pending = summary.pendingSetup ?? 0;

  if (total === 0) return "Sin advertisers mapeados";
  if (suspended === 0 && pending === 0 && active === total) {
    return "Todas en campaña";
  }

  const parts: string[] = [];
  if (active > 0) parts.push(`${formatNumber(active)} activa${active === 1 ? "" : "s"}`);
  if (suspended > 0) {
    parts.push(`${formatNumber(suspended)} suspendida${suspended === 1 ? "" : "s"}`);
  }
  if (pending > 0) parts.push(`${formatNumber(pending)} pendiente${pending === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

export function AdAccountsPageHeader({
  summary,
  hecomScoped = false,
  clienteName,
  avatarUrl,
  hideCreate = false,
}: AdAccountsPageHeaderProps) {
  const suspended = summary.disabledAccounts ?? 0;
  const pending = summary.pendingSetup ?? 0;
  const statusHint = accountStatusHint(summary);

  const metricItems: Array<{
    label: string;
    value: string;
    hint?: string;
    emphasis?: "primary" | "default" | "muted";
  }> = [
    {
      label: "Cuentas TikTok",
      value: formatNumber(summary.totalAccounts),
      hint: statusHint,
      emphasis: "primary",
    },
  ];

  if (suspended > 0) {
    metricItems.push({
      label: "Suspendidas",
      value: formatNumber(suspended),
      hint: "Requieren revisión en TikTok",
      emphasis: "muted",
    });
  }

  if (pending > 0) {
    metricItems.push({
      label: "Pendientes",
      value: formatNumber(pending),
      hint: "Sin setup completo",
      emphasis: "muted",
    });
  }

  return (
    <div className="space-y-4">
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
            detail={statusHint}
          />
        }
      />

      <CrmMetricRow items={metricItems} />
    </div>
  );
}
