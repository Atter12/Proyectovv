import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MissingCobroClaimPanel } from "@/features/clientes/components/MissingCobroClaimPanel.client";
import { ClienteCobrosMonthView } from "@/features/clientes/components/ClienteCobrosMonthView.client";
import type { HecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { routes } from "@/config/routes";
import { listMissingCobroClaimsForCliente } from "@/services/payments.service";
import { listRecentPeriodos } from "@/lib/payments/missing-cobro.shared";
import type { ManualPaymentIntentItem } from "@/services/payments.service";

export async function ClienteScopedCobros({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const t = await getTranslations("cobros");
  const { cliente, summary, cobros, gastos } = data;

  let claims: ManualPaymentIntentItem[] = [];
  try {
    claims = await listMissingCobroClaimsForCliente(cliente.id);
  } catch {
    claims = [];
  }
  const periodos = listRecentPeriodos(6);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--auth-divider)] pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
            {t("module")}
          </p>
          <h2 className="mt-1 text-[1.125rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
            {t("title", { name: cliente.name })}
          </h2>
          <p className="mt-1 max-w-3xl text-[12px] leading-5 text-[var(--auth-text-muted)]">
            {t("pageIntro")}
          </p>
        </div>
        <Link
          href={routes.payments}
          className="text-[12px] font-semibold text-[var(--auth-accent)] hover:underline"
        >
          {t("goPayments")}
        </Link>
      </header>

      <ClienteCobrosMonthView
        feePercent={summary.depositFeePercent}
        capped={gastos.length >= 4000 || cobros.length >= 800}
        gastos={gastos.map((row) => ({
          fecha: row.fecha,
          gasto: row.gasto,
          fee: row.fee,
          camp: row.camp,
        }))}
        cobros={cobros.map((row) => ({
          fecha: row.fecha,
          monto: row.monto,
          applicableMonto: row.applicableMonto,
          metodo: row.metodo,
          periodoResumen: row.periodoResumen,
          notas: row.notas,
        }))}
        historyCobros={cobros.map((row) => ({
          id: row.id,
          fecha: row.fecha,
          hora: row.hora,
          codigo: row.codigo,
          periodoResumen: row.periodoResumen,
          monto: row.monto,
          metodo: row.metodo,
          comprobanteUrls: row.comprobanteUrls,
          registeredBy: row.registeredBy,
          registeredAt: row.registeredAt,
        }))}
      />

      <MissingCobroClaimPanel periodos={periodos} initialClaims={claims} />
    </div>
  );
}
