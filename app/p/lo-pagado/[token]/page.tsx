import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClienteCobrosMonthView } from "@/features/clientes/components/ClienteCobrosMonthView.client";
import { PublicLoPagadoActions } from "@/features/clientes/components/PublicLoPagadoActions.client";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { verifyLoPagadoToken } from "@/lib/hecom/lo-pagado-public-token";
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

/** Tema visual del link público (solo colores; no toca datos). */
const LO_PAGADO_THEME = {
  backgroundColor: "#eef1ec",
  "--auth-bg": "#f3f5f1",
  "--auth-border": "#e4e9e3",
  "--auth-divider": "#e4e9e3",
  "--auth-text": "#0f1f17",
  "--auth-text-muted": "#5f6f66",
  "--auth-text-soft": "#8b988f",
  "--auth-muted": "#8b988f",
  "--auth-accent": "#1d5a43",
  "--auth-accent-hover": "#12372a",
  "--auth-accent-soft": "#eef7d9",
  "--auth-accent-ring": "rgb(29 90 67 / 0.2)",
  "--auth-control-border": "#dfe5de",
  "--auth-control-hover": "#f3f7ee",
  "--auth-input-border": "#dbe2da",
  "--auth-input-border-hover": "#c3cec5",
  "--admin-accent": "#12372a",
  "--admin-accent-hover": "#1d5a43",
  "--admin-accent-soft": "#eef7d9",
} as CSSProperties;

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
  try {
    claims = await listMissingCobroClaimsForCliente(clientId);
  } catch {
    claims = [];
  }

  const initials = cliente.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <main
      className="dashboard-canvas min-h-screen px-4 pb-12 pt-4 sm:px-6 sm:pt-6"
      style={LO_PAGADO_THEME}
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <nav className="flex items-center justify-between gap-3 rounded-[20px] bg-white px-3 py-2.5 ring-1 ring-[#e4e9e3] sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#12372a] text-[#b8e04f]"
              aria-hidden
            >
              <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none">
                <path
                  d="M10 2.5v15M2.5 10h15M4.7 4.7l10.6 10.6M15.3 4.7 4.7 15.3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#0f1f17]">
                Holistic Marketing
              </p>
              <p className="text-[11px] text-[#8b988f]">Estado de cuenta</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-full bg-[#f3f5f1] py-1 pl-1 pr-3 ring-1 ring-[#e4e9e3]">
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#b8e04f] text-[11px] font-bold text-[#12372a]"
              aria-hidden
            >
              {initials || "C"}
            </span>
            <span className="max-w-[9rem] truncate text-[12px] font-semibold text-[#0f1f17] sm:max-w-[16rem]">
              {cliente.name}
            </span>
          </div>
        </nav>

        <header className="px-1">
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.04em] text-[#0f1f17] sm:text-[2rem]">
            Lo pagado
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#5f6f66]">
            Gastos diarios de ads (con fee) y pagos de este mes. Solo ves el mes
            del mensaje de cobranza. Desde aquí también puedes pagar o avisar
            si no ves un pago de ese mes.
          </p>
        </header>
        <ClienteCobrosMonthView
          initialMonth={month}
          lockMonth
          hideStaff
          proofApiBase={apiBase}
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
            comprobanteUrls: row.comprobanteUrls.map(() => "1"),
            registeredBy: null,
            registeredAt: row.registeredAt,
          }))}
        />
        <PublicLoPagadoActions
          apiBase={apiBase}
          month={month}
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
