import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClienteCobrosMonthView } from "@/features/clientes/components/ClienteCobrosMonthView.client";
import { PublicLoPagadoActions } from "@/features/clientes/components/PublicLoPagadoActions.client";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { verifyLoPagadoToken } from "@/lib/hecom/lo-pagado-public-token";
import { listPublicLoPagadoActivity } from "@/lib/payments/public-lo-pagado.server";
import { todayYmdInTz } from "@/lib/hecom/gasto-date";
import { serverEnv } from "@/lib/env/env.server";
import { listMissingCobroClaimsForCliente } from "@/services/payments.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lo pagado · Holistic Marketing",
  robots: { index: false, follow: false },
};

function monthFromQuery(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^\d{4}-\d{2}$/.test(raw) ? raw : undefined;
}

function publicLinkMonth(value: string | string[] | undefined): string {
  const now = todayYmdInTz("America/Lima").slice(0, 7);
  const raw = monthFromQuery(value);
  if (raw && raw <= now) return raw;
  return now;
}

export default async function LoPagadoPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const clientId = verifyLoPagadoToken(token, serverEnv.holisticWaSnapshotSecret);
  if (!clientId) notFound();

  const data = await getHecomClienteDashboard(clientId, {
    includeCampaignSpend: false,
    includeCreativos: false,
    includeDailySpend: false,
    fullFinance: true,
  });
  if (!data) notFound();

  const { cliente, summary, cobros, gastos } = data;
  const month = publicLinkMonth(query.m);
  const apiBase = `/api/public/lo-pagado/${encodeURIComponent(token)}`;
  let claims: Awaited<ReturnType<typeof listMissingCobroClaimsForCliente>> = [];
  let activity: Awaited<ReturnType<typeof listPublicLoPagadoActivity>> = [];
  try {
    [claims, activity] = await Promise.all([
      listMissingCobroClaimsForCliente(clientId),
      listPublicLoPagadoActivity(clientId),
    ]);
  } catch {
    claims = [];
    activity = [];
  }

  return (
    <main className="dashboard-canvas min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="border-b border-[var(--auth-divider)] pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">
            Holistic Marketing
          </p>
          <h1 className="mt-1 text-[1.35rem] font-semibold tracking-[-0.03em] text-[#1a1714]">
            Lo pagado · {cliente.name}
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#5c564e]">
            Gastos diarios de ads (con fee) y pagos de este mes. Solo ves el mes
            del mensaje de cobranza. Desde aquí también puedes pagar o avisar
            si no ves un pago de ese mes.
          </p>
        </header>
        <ClienteCobrosMonthView
          initialMonth={month}
          lockMonth
          hideStaff
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
            comprobanteUrls: [],
            registeredBy: null,
            registeredAt: row.registeredAt,
          }))}
        />
        <PublicLoPagadoActions
          apiBase={apiBase}
          feePercent={summary.depositFeePercent}
          month={month}
          activity={activity}
          claims={claims.map((claim) => ({
            ...claim,
            actorEmail: null,
            actorName: null,
            proofSignedUrl: null,
            organizationName: null,
          }))}
        />
      </div>
    </main>
  );
}
