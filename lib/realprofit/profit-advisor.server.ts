import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { getHecomAdAccountsLiveMetrics } from "@/lib/hecom/ad-account-live.server";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { defaultProfitDateRange } from "@/lib/realprofit/db.server";
import { loadClienteProfitPromo } from "@/lib/realprofit/profit-snapshot.server";

export type ProfitAdvisorTurn = {
  role: "user" | "assistant";
  content: string;
};

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "n/d";
  return `$${n.toFixed(2)}`;
}

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "n/d";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(0)}%`;
}

function ymdKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (!dmy) return null;
  return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
}

function inRange(fecha: string | null | undefined, from: string, to: string) {
  const key = ymdKey(fecha);
  if (!key) return false;
  return key >= from && key <= to;
}

/**
 * Contexto compacto para el asesor de gerencia (OpenAI).
 * Solo hechos del cliente seleccionado — sin inventar.
 */
export async function buildProfitAdvisorBrief(input: {
  hecomClienteId: string;
  clienteName: string;
  from?: string;
  to?: string;
}): Promise<{ brief: string; from: string; to: string }> {
  const range = defaultProfitDateRange();
  const from = input.from?.trim() || range.from;
  const to = input.to?.trim() || range.to;

  const [data, dashboard, live] = await Promise.all([
    loadClienteProfitPromo({
      hecomClienteId: input.hecomClienteId,
      from,
      to,
    }),
    getHecomClienteDashboard(input.hecomClienteId, {
      fullFinance: true,
      includeCampaignSpend: false,
      includeCreativos: false,
      includeDailySpend: true,
    }).catch(() => null),
    getHecomAdAccountsLiveMetrics(input.hecomClienteId, "fast").catch(() => null),
  ]);

  const a = data.analysis;
  const ops = data.staffOps;
  const score = ops.score;
  const topCampaigns = [...a.campaigns]
    .sort((x, y) => y.spend - x.spend)
    .slice(0, 8)
    .map((c) => ({
      name: c.campaignName,
      spend: Number(c.spend.toFixed(2)),
      ctr: c.ctr,
      conversions: c.conversions,
      bm: c.bm,
    }));
  const signals = a.signals.slice(0, 8).map((s) => ({
    severity: s.severity,
    kind: s.kind,
    title: s.title,
    detail: s.detail,
  }));
  const stores = data.snapshots
    .filter((s) => s.store.id !== "__holistic_tiktok__")
    .map((s) => ({
      store: s.store.name || s.store.shopDomain || s.store.id,
      collected: Number(s.collectedRevenue.toFixed(2)),
      adSpend: Number(s.adSpend.toFixed(2)),
      roas: s.roasCollected,
      orders: s.ordersCollected,
    }));

  let cobroTotalHol: number | null = null;
  let debeAbs: number | null = null;
  let aFavorAbs: number | null = null;
  let cargoTotal: number | null = null;
  let gastoTotalHist: number | null = null;
  let gastoHoyHecom: number | null = null;
  let gasto7dHecom: number | null = null;

  if (dashboard) {
    const s = dashboard.summary;
    cobroTotalHol = s.cobroTotal;
    cargoTotal = s.cargoTotal;
    gastoTotalHist = s.gastoTotal;
    gastoHoyHecom = s.gastoHoy;
    gasto7dHecom = s.gasto7d;
    if (s.saldoEstimado < -0.004) debeAbs = Math.abs(s.saldoEstimado);
    else if (s.saldoEstimado > 0.004) aFavorAbs = s.saldoEstimado;
  }

  // Misma cifra que el panel de gerencia “Gasto hoy” (live TikTok si hay).
  const liveSpendToday =
    live?.accounts.reduce((sum, row) => sum + (row.spendTodayUsd ?? 0), 0) ??
    null;
  const gastoHoyProfit = a.spendToday;
  const gastoHoyMostrar =
    liveSpendToday != null && liveSpendToday > 0.004
      ? liveSpendToday
      : Number.isFinite(gastoHoyProfit) && gastoHoyProfit > 0
        ? gastoHoyProfit
        : (gastoHoyHecom ?? gastoHoyProfit);

  const lines: string[] = [
    `Cliente: ${input.clienteName} (id ${input.hecomClienteId})`,
    `Rango UI Profit: ${from} → ${to}`,
    "",
    "## NUMEROS LISTOS (copiá estos; no inventes ni pongas $0 si acá hay valor)",
    `Cobrado total vouchers: ${money(cobroTotalHol)}`,
    debeAbs != null
      ? `Debe: ${money(debeAbs)}`
      : aFavorAbs != null
        ? `A favor: ${money(aFavorAbs)}`
        : "Debe: $0.00 (cuadrado)",
    `Cargo total (gasto+fee histórico): ${money(cargoTotal)}`,
    `Gasto ads histórico (Hecom): ${money(gastoTotalHist)}`,
    `Gasto hoy (TikTok live — PRIORIDAD, igual que el panel): ${money(gastoHoyMostrar)}`,
    `Gasto hoy snapshot Profit: ${money(gastoHoyProfit)} · Hecom: ${money(gastoHoyHecom)}`,
    live
      ? `Live sync: ${live.accounts.length} cuentas · ${live.updatedAt}`
      : "Live TikTok: no disponible",
    `Gasto 7d (Profit — PRIORIDAD): ${money(a.spend7d)} · Hecom 7d: ${money(gasto7dHecom)}`,
    `Gasto 30d Profit: ${money(a.spend30d)}`,
    `Cartera: ${money(ops.walletAvailableUsd)} · Ledger cuentas: ${money(ops.adLedgerAvailableUsd)}`,
    `Riesgo: ${score ? `${score.score ?? "n/d"} (${score.verdict})` : "n/d"}`,
    "",
  ];

  if (dashboard) {
    const s = dashboard.summary;
    const gastosInRange = dashboard.gastos.filter((g) =>
      inRange(g.fecha, from, to),
    );
    const cobrosInRange = dashboard.cobros.filter((c) =>
      inRange(c.fecha, from, to),
    );
    const gastoRange = gastosInRange.reduce((sum, g) => sum + g.gasto, 0);
    const feeRange = gastosInRange.reduce((sum, g) => {
      const pctFee =
        g.fee != null && Number.isFinite(g.fee) ? g.fee : s.depositFeePercent;
      return sum + (pctFee > 0 ? g.gasto * (pctFee / 100) : 0);
    }, 0);
    const cobroRange = cobrosInRange.reduce((sum, c) => sum + c.monto, 0);
    const cargoRange = Math.round((gastoRange + feeRange) * 100) / 100;
    const saldoRange = Math.round((cobroRange - cargoRange) * 100) / 100;

    const recentCobros = [...dashboard.cobros]
      .sort((x, y) => String(y.fecha ?? "").localeCompare(String(x.fecha ?? "")))
      .slice(0, 8)
      .map((c) => ({
        fecha: c.fecha,
        monto: Number(c.monto.toFixed(2)),
        metodo: c.metodo,
      }));

    lines.push(
      "## Holistic vouchers (detalle)",
      `Fuente: ${dashboard.source}`,
      `Fee: ${s.depositFeePercent}% (${s.depositFeeSource})`,
      `En rango ${from}→${to}: gasto ${money(gastoRange)} · cargo ${money(cargoRange)} · cobrado ${money(cobroRange)} · saldo rango ${money(saldoRange)}`,
      `Últimos cobros: ${JSON.stringify(recentCobros)}`,
      "",
    );
  } else {
    lines.push(
      "## Holistic vouchers",
      "No se pudo cargar Hecom. No digas cobrado $0 por COD.",
      "",
    );
  }

  lines.push(
    "## Gasto TikTok live / pacing",
    `Hoy: ${money(a.spendToday)} (${pct(a.spendTodayDeltaPct)} vs ayer)`,
    `7d: ${money(a.spend7d)} (${pct(a.spend7dDeltaPct)} vs 7d previo)`,
    `30d: ${money(a.spend30d)}`,
    `Pacing: ${a.pacingLabel} (ratio ${a.pacingRatio?.toFixed(2) ?? "n/d"})`,
    "",
    "## Performance TikTok",
    a.perf.available
      ? `Imp ${a.perf.impressions} · Clicks ${a.perf.clicks} · Conv ${a.perf.conversions} · CTR ${a.perf.avgCtr?.toFixed(2) ?? "n/d"}%`
      : `Perf no disponible${a.perf.error ? `: ${a.perf.error}` : ""}`,
    "",
    "## COD Shopify (NO es cobros Holistic)",
    `Tienda COD: ${a.hasCodLink ? "sí" : "no"} · collected ${money(a.collectedRevenue)} · órdenes ${a.ordersCollected}`,
    stores.length ? `Tiendas: ${JSON.stringify(stores)}` : "Sin tienda RealProfit.",
    "",
    "## Crédito / ops",
    `Cartera ${money(ops.walletAvailableUsd)} · ledger ${money(ops.adLedgerAvailableUsd)} (${ops.accountsWithLedgerBalance} cta)`,
    ops.lastAllocation
      ? `Última asignación ${money(ops.lastAllocation.amountUsd)} → ${ops.lastAllocation.accountLabel} hace ${ops.lastAllocation.hoursAgo.toFixed(1)} h`
      : "Sin asignación reciente",
    `Burn: ${ops.burn.status} · hint: ${ops.creditHint}`,
    "",
    "## Semáforo",
    score
      ? `Score ${score.score ?? "n/d"} · ${score.verdict} · ${JSON.stringify(score.factors)}`
      : "n/d",
    "",
    "## Señales",
    signals.length ? JSON.stringify(signals) : "Sin señales",
    "",
    "## Top campañas",
    topCampaigns.length ? JSON.stringify(topCampaigns) : "Sin campañas",
  );

  return { brief: lines.join("\n"), from, to };
}

export async function askProfitAdvisor(input: {
  hecomClienteId: string;
  clienteName: string;
  message: string;
  history?: ProfitAdvisorTurn[];
  from?: string;
  to?: string;
}): Promise<{ reply: string; from: string; to: string }> {
  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada.");
  }

  const { brief, from, to } = await buildProfitAdvisorBrief({
    hecomClienteId: input.hecomClienteId,
    clienteName: input.clienteName,
    from: input.from,
    to: input.to,
  });

  const system = `Sos el asesor de gerencia Holistic. Español claro, corto, tipo WhatsApp.

Glosario:
- Cobros / vouchers / deuda = números de "NUMEROS LISTOS" (vouchers Holistic). Nunca uses COD Shopify.
- Gasto hoy = PRIORIDAD "TikTok live" de NUMEROS LISTOS (igual al panel). Nunca digas $0 si esa línea tiene otro valor.
- Gasto 7d = Profit 7d de NUMEROS LISTOS.
- COD Shopify = solo si preguntan COD/Shopify.

Formato:
- Sin markdown (# ni **). Máx 6 líneas.
- Solo cobros: 
  Cobrado total: $X
  Debe: $Y
- Si piden gastos + cobrado + deuda (o “dame el resumen de plata”):
  Cobrado total: $X
  Debe: $Y
  Gasto hoy: $Z
  Gasto 7d: $W
  (opcional 1 línea: Cargo histórico $… o pacing)
- Resumen general: riesgo + cobrado/deuda + gasto hoy/7d + 1 tip.
- Crédito: sí/no + 1 motivo.
- Solo DATOS DEL CLIENTE. No inventes.

DATOS DEL CLIENTE:
${brief}`;

  const history = (input.history ?? [])
    .filter(
      (t) =>
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string" &&
        t.content.trim().length > 0,
    )
    .slice(-8)
    .map((t) => ({
      role: t.role,
      content: t.content.trim().slice(0, 1200),
    }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: serverEnv.openAiVisionModel,
      temperature: 0.2,
      max_tokens: 320,
      messages: [
        { role: "system", content: system },
        ...history,
        { role: "user", content: input.message.trim().slice(0, 800) },
      ],
    }),
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI ${response.status}`);
  }
  const reply = String(data.choices?.[0]?.message?.content ?? "")
    .trim()
    .slice(0, 4000);
  if (!reply) throw new Error("Respuesta vacía del asesor.");
  return { reply, from, to };
}
