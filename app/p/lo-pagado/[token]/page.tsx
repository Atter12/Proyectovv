import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { PublicAccountStatement } from "@/features/clientes/components/PublicAccountStatement";
import { PublicAccountHeader } from "@/features/clientes/components/PublicAccountHeader";
import { PublicLoPagadoActions } from "@/features/clientes/components/PublicLoPagadoActions.client";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { verifyLoPagadoToken } from "@/lib/hecom/lo-pagado-public-token";
import { listPublicLoPagadoActivity } from "@/lib/payments/public-lo-pagado.server";
import { todayYmdInTz } from "@/lib/hecom/gasto-date";
import { serverEnv } from "@/lib/env/env.server";
import { listMissingCobroClaimsForCliente } from "@/services/payments.service";
import { buildCobranzaMonthSnapshot } from "@/lib/hecom/cobranza-month-snapshot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu estado de cuenta · Holistic Marketing",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

function monthFromQuery(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : undefined;
}

function publicLinkMonth(value: string | string[] | undefined, today: string): string {
  const now = today.slice(0, 7);
  const raw = monthFromQuery(value);
  if (raw && raw <= now) return raw;
  return now;
}

function statementDate(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  return dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` : null;
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
  const today = todayYmdInTz("America/Lima");
  const month = publicLinkMonth(query.m, today);
  const snapshot = buildCobranzaMonthSnapshot({
    gastos,
    cobros,
    feePercent: summary.depositFeePercent,
    monthYm: month,
    todayYmd: today,
  });
  const monthLabel = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
  const monthPayments = cobros.filter((row) => {
    const period = row.periodoResumen?.trim().match(/^(\d{4}-\d{2})/)?.[1];
    if (period) return period === month;
    const date = statementDate(row.fecha);
    return Boolean(date && date >= snapshot.from && date <= snapshot.chartTo);
  }).map((row) => ({
    id: row.id,
    fecha: statementDate(row.fecha),
    codigo: row.codigo,
    monto: row.monto,
    applicableMonto: Number.isFinite(row.applicableMonto) ? row.applicableMonto : row.monto,
    metodo: row.metodo,
  })).sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
  const monthExpenses = gastos.flatMap((row) => {
    const date = statementDate(row.fecha);
    return date && date >= snapshot.from && date <= snapshot.spendTo
      ? [{ fecha: date, gasto: row.gasto, cuenta: row.camp?.split("|")[0].trim() || "Cuenta publicitaria" }]
      : [];
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const apiBase = `/api/public/lo-pagado/${encodeURIComponent(token)}`;
  let claims: Awaited<ReturnType<typeof listMissingCobroClaimsForCliente>> = [];
  let activity: Awaited<ReturnType<typeof listPublicLoPagadoActivity>> = [];
  let activityUnavailable = false;
  try {
    [claims, activity] = await Promise.all([
      listMissingCobroClaimsForCliente(clientId, { month, throwOnError: true }),
      listPublicLoPagadoActivity(clientId, { month, throwOnError: true }),
    ]);
  } catch {
    activityUnavailable = true;
    claims = [];
    activity = [];
  }

  return (
    <main className="dashboard-canvas min-h-screen px-4 py-6 text-[var(--admin-text)] selection:bg-[var(--admin-accent-soft)] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <PublicAccountHeader clientName={cliente.name} monthLabel={monthLabel} />
        <PublicAccountStatement
          snapshot={snapshot}
          payments={monthPayments}
          expenses={monthExpenses}
          capped={gastos.length >= 4000 || cobros.length >= 800}
        >
          <PublicLoPagadoActions
            presentation="portal"
            debtAmountUsd={snapshot.deudaCorte}
            activityUnavailable={activityUnavailable}
            apiBase={apiBase}
            month={month}
            activity={activity.filter((row) => row.periodoResumen === month)}
            claims={claims.filter((claim) => claim.periodoResumen === month).map((claim) => ({
              ...claim,
              actorEmail: null,
              actorName: null,
              proofSignedUrl: null,
              organizationName: null,
            }))}
          />
        </PublicAccountStatement>
      </div>
    </main>
  );
}
