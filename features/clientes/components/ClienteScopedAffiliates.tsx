import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/routes";
import { ClienteScopePageHeader } from "@/features/clientes/components/ClienteScopePageChrome";
import type { HecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";

export function ClienteScopedAffiliates({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  return (
    <div className="space-y-6">
      <ClienteScopePageHeader
        eyebrow="Afiliados · cliente"
        title="Programa de afiliados"
        description={`Panel filtrado por ${data.cliente.name}.`}
        name={data.cliente.name}
        avatarUrl={data.cliente.avatarUrl}
      />

      <Card className="dashboard-surface-card p-6 text-sm text-[#6b645c]">
        <p className="font-display text-lg font-medium text-[#141210]">
          Sin afiliados por cliente en Hecom
        </p>
        <p className="mt-2 leading-relaxed">
          El programa de afiliados es de la agencia (no hay tabla de referrals por
          cliente en Hecom Club). Por eso acá no se mezclan datos de otros
          clientes ni de la org genérica.
        </p>
        <p className="mt-4">
          Seguís viendo solo el contexto de {data.cliente.name}:{" "}
          <Link
            href={routes.payments}
            className="font-semibold text-[var(--brand-primary-deep)] hover:underline"
          >
            pagos
          </Link>
          ,{" "}
          <Link
            href={routes.adAccounts}
            className="font-semibold text-[var(--brand-primary-deep)] hover:underline"
          >
            cuentas
          </Link>{" "}
          y{" "}
          <Link
            href={routes.creativeAnalyzer}
            className="font-semibold text-[var(--brand-primary-deep)] hover:underline"
          >
            creativos
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
