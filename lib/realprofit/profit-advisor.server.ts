import "server-only";
import { serverEnv } from "@/lib/env/env.server";
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

  const [data, dashboard] = await Promise.all([
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

  const lines: string[] = [
    `Cliente: ${input.clienteName} (id ${input.hecomClienteId})`,
    `Rango UI Profit: ${from} → ${to}`,
    "",
  ];

  // Holistic vouchers FIRST — this is what gerencia means by cobros/gastos.
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
        g.fee != null && Number.isFinite(g.fee)
          ? g.fee
          : s.depositFeePercent;
      return sum + (pctFee > 0 ? g.gasto * (pctFee / 100) : 0);
    }, 0);
    const cobroRange = cobrosInRange.reduce((sum, c) => sum + c.monto, 0);
    const cargoRange = Math.round((gastoRange + feeRange) * 100) / 100;
    const saldoRange = Math.round((cobroRange - cargoRange) * 100) / 100;

    const recentCobros = [...dashboard.cobros]
      .sort((x, y) => String(y.fecha ?? "").localeCompare(String(x.fecha ?? "")))
      .slice(0, 12)
      .map((c) => ({
        fecha: c.fecha,
        monto: Number(c.monto.toFixed(2)),
        metodo: c.metodo,
        notas: c.notas?.slice(0, 80) ?? null,
        vouchers: c.comprobanteUrls.length,
      }));
    const recentGastos = [...dashboard.gastos]
      .sort((x, y) => String(y.fecha ?? "").localeCompare(String(x.fecha ?? "")))
      .slice(0, 10)
      .map((g) => ({
        fecha: g.fecha,
        gasto: Number(g.gasto.toFixed(2)),
        fee: g.fee,
        camp: g.camp,
      }));

    lines.push(
      "## Holistic vouchers / estado de cuenta (FUENTE PRINCIPAL de cobros y gastos)",
      "Esto es lo mismo que Cobros → vouchers en Holistic (tablas Hecom gastos + cobros).",
      `Fuente datos: ${dashboard.source}`,
      `TOTAL cargado (gasto+fee histórico listado): ${money(s.cargoTotal)} · gasto ${money(s.gastoTotal)} · fee ${money(s.feeTotal)}`,
      `TOTAL cobrado (cobros Holistic / vouchers): ${money(s.cobroTotal)}`,
      `Saldo estimado (cobrado − cargo): ${money(s.saldoEstimado)} ${s.saldoEstimado < -0.01 ? "(cliente debe)" : s.saldoEstimado > 0.01 ? "(a favor del cliente)" : "(casi cuadrado)"}`,
      `Fee Holistic: ${s.depositFeePercent}% (${s.depositFeeSource})`,
      `En el rango ${from}→${to}: gasto ${money(gastoRange)} · fee ~${money(feeRange)} · cargo ${money(cargoRange)} · cobrado ${money(cobroRange)} · saldo rango ${money(saldoRange)}`,
      `Filas: ${dashboard.cobros.length} cobros · ${dashboard.gastos.length} gastos (listado)`,
      `Últimos cobros (voucher): ${JSON.stringify(recentCobros)}`,
      `Últimos gastos: ${JSON.stringify(recentGastos)}`,
      "",
    );
  } else {
    lines.push(
      "## Holistic vouchers / estado de cuenta",
      "No se pudo cargar el dashboard Hecom (gastos/cobros). NO digas que cobró $0 por COD; decí que faltan vouchers Holistic.",
      "",
    );
  }

  lines.push(
    "## Gasto TikTok live / pacing (Profit)",
    `Hoy: ${money(a.spendToday)} (${pct(a.spendTodayDeltaPct)} vs ayer)`,
    `7d: ${money(a.spend7d)} (${pct(a.spend7dDeltaPct)} vs 7d previo)`,
    `30d: ${money(a.spend30d)}`,
    `En rango Profit: ${money(a.spendInRange)} (${pct(a.spendRangeDeltaPct)} vs periodo previo)`,
    `Pacing: ${a.pacingLabel} (ratio ${a.pacingRatio?.toFixed(2) ?? "n/d"})`,
    `Días con actividad: ${a.daysWithActivity}`,
    `Datos hasta: ${a.dataThroughDate ?? "n/d"}`,
    "",
    "## Performance TikTok",
    a.perf.available
      ? `Imp ${a.perf.impressions} · Clicks ${a.perf.clicks} · Conv ${a.perf.conversions} · CTR ${a.perf.avgCtr?.toFixed(2) ?? "n/d"}% · CPC ${money(a.perf.avgCpc)} · CPM ${money(a.perf.avgCpm)}`
      : `Perf no disponible${a.perf.error ? `: ${a.perf.error}` : ""}`,
    "",
    "## COD Shopify / RealProfit (OPCIONAL — NO es cobros Holistic)",
    "Si preguntan 'cobros' o 'vouchers', IGNORÁ esta sección salvo que digan COD/Shopify/RealProfit.",
    `Tienda vinculada COD: ${a.hasCodLink ? "sí" : "no"}`,
    `Cobrado collected (órdenes COD): ${money(a.collectedRevenue)} · Órdenes: ${a.ordersCollected}`,
    `ROAS collected: ${a.roasCollected?.toFixed(2) ?? "n/d"} · ROAS efectivo: ${a.roasEffective?.toFixed(2) ?? "n/d"}`,
    stores.length
      ? `Tiendas: ${JSON.stringify(stores)}`
      : "Sin tiendas RealProfit vinculadas (normal si el cliente no usa COD).",
    "",
    "## Crédito / ops (gerencia)",
    `Cartera Holistic: ${money(ops.walletAvailableUsd)}`,
    `Saldo ledger cuentas: ${money(ops.adLedgerAvailableUsd)} (${ops.accountsWithLedgerBalance} con saldo)`,
    ops.lastAllocation
      ? `Última asignación: ${money(ops.lastAllocation.amountUsd)} → ${ops.lastAllocation.accountLabel} hace ${ops.lastAllocation.hoursAgo.toFixed(1)} h`
      : "Sin asignación reciente registrada",
    `Burn: ${ops.burn.status} (crit ${ops.burn.critical} / warn ${ops.burn.warn} / info ${ops.burn.info})`,
    `Hint crédito: ${ops.creditHint}`,
    `Depósitos wallet 90d (conteo): ${ops.collections.deposits90d ?? "n/d"} · fallidos: ${ops.collections.failedDeposits90d ?? "n/d"} · tickets abiertos: ${ops.collections.openTickets ?? "n/d"}`,
    "",
    "## Semáforo de riesgo",
    score
      ? `Score ${score.score ?? "n/d"} / 100 · verdict ${score.verdict} · factores ${JSON.stringify(score.factors)}`
      : "Score no disponible",
    "",
    "## Señales",
    signals.length ? JSON.stringify(signals) : "Sin señales",
    "",
    "## Top campañas por gasto",
    topCampaigns.length ? JSON.stringify(topCampaigns) : "Sin campañas con gasto",
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

  const system = `Sos el asesor de gerencia Holistic (Profit + Cobros/vouchers).
Hablás con un GERENTE sobre UN cliente. Español claro, profesional, directo.

Glosario obligatorio:
- "Cobros" / "vouchers" / "lo pagado" / "deuda" = sección Holistic vouchers (Hecom cobros + gastos + fee). NUNCA uses el cobrado COD de RealProfit para responder eso.
- "COD" / "Shopify" / "RealProfit collected" = ventas COD de tienda (puede ser $0 sin tienda vinculada). Solo menciónalo si preguntan COD/Shopify/ROAS de tienda.
- "Gasto" ads = gasto TikTok / gastos Hecom según el bloque que corresponda.

Reglas:
- Solo usá DATOS DEL CLIENTE abajo. Si falta un dato, decí “no figura”.
- NO inventes montos. NO digas “cobrado $0” por falta de tienda COD si hay cobros Holistic en vouchers.
- Priorizá: estado de cuenta Holistic (cargo, cobrado, saldo), luego riesgo/crédito, pacing y performance.
- Respuestas cortas (máx ~180 palabras) salvo que pidan detalle. Bullets OK.

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
      temperature: 0.3,
      max_tokens: 700,
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
