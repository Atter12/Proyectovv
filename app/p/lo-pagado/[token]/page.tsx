import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClienteCobrosMonthView } from "@/features/clientes/components/ClienteCobrosMonthView.client";
import { PublicLoPagadoActions } from "@/features/clientes/components/PublicLoPagadoActions.client";
import { CLIENT_COBROS_FROM_MONTH } from "@/features/clientes/components/ClienteScopedCobros";
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

/** YYYY-MM de una fecha o periodo; null si no se puede leer. */
function monthOf(value: string | null | undefined): string | null {
  const match = String(value ?? "").trim().match(/^(\d{4}-\d{2})/);
  return match ? match[1]! : null;
}

function publicLinkMonth(value: string | string[] | undefined): string {
  const now = todayYmdInTz("America/Lima").slice(0, 7);
  const raw = monthFromQuery(value);
  if (raw && raw >= CLIENT_COBROS_FROM_MONTH && raw <= now) return raw;
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

  const { cliente, summary } = data;
  // Igual que la vista cliente: desde setiembre 2026; los meses anteriores no llegan al navegador.
  const visible = (m: string | null) => m !== null && m >= CLIENT_COBROS_FROM_MONTH;
  const gastos = data.gastos.filter((row) => visible(monthOf(row.fecha)));
  const cobros = data.cobros.filter((row) => visible(monthOf(row.periodoResumen) ?? monthOf(row.fecha)));
  const month = publicLinkMonth(query.m);
  const apiBase = `/api/public/lo-pagado/${encodeURIComponent(token)}`;
  let claims: Awaited<ReturnType<typeof listMissingCobroClaimsForCliente>> = [];
  try {
    claims = (await listMissingCobroClaimsForCliente(clientId)).filter((claim) =>
      visible(monthOf(claim.createdAt)),
    );
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
      className="dashboard-canvas min-h-screen px-4 pb-12 pt-4 sm:px-6 sm:pt-6 lg:px-8 2xl:px-10"
    >
      <div className="mx-auto w-full max-w-[1920px] space-y-5">
        <nav className="flex items-center justify-between gap-3 rounded-[20px] bg-white px-3 py-2.5 ring-1 ring-[#e8dfd4] sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1a1714] text-[#f0b889]"
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
              <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#1a1714]">
                Holistic Marketing
              </p>
              <p className="text-[11px] text-[#8a8177]">Estado de cuenta</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-full bg-[#faf8f5] py-1 pl-1 pr-3 ring-1 ring-[#e8dfd4]">
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f7f0e9] text-[11px] font-bold text-[#b85f2e]"
              aria-hidden
            >
              {initials || "C"}
            </span>
            <span className="max-w-[9rem] truncate text-[12px] font-semibold text-[#1a1714] sm:max-w-[16rem]">
              {cliente.name}
            </span>
          </div>
        </nav>

        <header className="px-1">
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.04em] text-[#1a1714] sm:text-[2rem]">
            Lo pagado
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#5c564e]">
            Gastos diarios de ads (con fee) y pagos desde setiembre 2026. Elige
            el mes arriba; desde aquí también puedes pagar o avisar si no ves un
            pago de ese mes.
          </p>
        </header>
        <ClienteCobrosMonthView
          initialMonth={month}
          syncMonthToUrl
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
