import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/routes";
import type { HecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";

export function ClienteScopedAffiliates({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          Afiliados · cliente
        </p>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">
          Programa de afiliados
        </h1>
        <p className="mt-2 text-sm text-[var(--admin-text-muted,#64748b)]">
          Estás viendo el panel filtrado por <strong>{data.cliente.name}</strong>.
        </p>
      </div>

      <Card className="p-6 text-sm text-[var(--admin-text-muted,#64748b)]">
        <p className="font-semibold text-[var(--foreground)]">
          Sin afiliados por cliente en Hecom
        </p>
        <p className="mt-2">
          El programa de afiliados es de la agencia (no hay tabla de referrals por
          cliente en Hecom Club). Por eso acá no se mezclan datos de otros
          clientes ni de la org genérica.
        </p>
        <p className="mt-4">
          Seguís viendo solo el contexto de {data.cliente.name}:{" "}
          <Link
            href={routes.payments}
            className="font-semibold text-[var(--brand-primary)] hover:underline"
          >
            pagos
          </Link>
          ,{" "}
          <Link
            href={routes.adAccounts}
            className="font-semibold text-[var(--brand-primary)] hover:underline"
          >
            cuentas
          </Link>{" "}
          y{" "}
          <Link
            href={routes.creativeAnalyzer}
            className="font-semibold text-[var(--brand-primary)] hover:underline"
          >
            creativos
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
