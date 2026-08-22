import { routes } from "@/config/routes";
import {
  CrmHeroButton,
  CrmMetricCell,
  CrmMetricsStrip,
  CrmQuickLinks,
  CrmScopeHero,
} from "@/components/dashboard/crm-ui";
import type { HecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";

export function ClienteScopedAffiliates({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente } = data;

  return (
    <div className="space-y-5 sm:space-y-6">
      <CrmScopeHero
        module="Afiliados"
        title="Programa de afiliados"
        cliente={{ name: cliente.name, avatarUrl: cliente.avatarUrl }}
        meta="Alcance organización · no por cliente Hecom"
        actions={
          <>
            <CrmHeroButton href={routes.payments}>Ir a pagos</CrmHeroButton>
            <CrmHeroButton href={routes.adAccounts} variant="secondary">
              Ver cuentas
            </CrmHeroButton>
          </>
        }
      />

      <CrmMetricsStrip>
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:divide-x sm:divide-[var(--auth-divider)]">
          <CrmMetricCell label="Referrals Hecom" value="—" hint="No por cliente" emphasis="muted" />
          <CrmMetricCell label="Alcance" value="Org" hint="Programa agencia" emphasis="muted" />
          <CrmMetricCell
            label="Contexto activo"
            value={cliente.name.split(" ")[0] ?? cliente.name}
            hint="Filtro de cliente"
          />
        </div>
      </CrmMetricsStrip>

      <CrmQuickLinks
        links={[
          { href: routes.payments, label: "Pagos" },
          { href: routes.adAccounts, label: "Cuentas ads" },
          { href: routes.creativeAnalyzer, label: "Creativos" },
        ]}
      />
    </div>
  );
}
