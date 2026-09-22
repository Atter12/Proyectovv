import "server-only";
import { serverEnv } from "@/lib/env/env.server";
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
  const data = await loadClienteProfitPromo({
    hecomClienteId: input.hecomClienteId,
    from,
    to,
  });
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
    `Rango análisis: ${from} → ${to}`,
    "",
    "## Gasto / pacing",
    `Hoy: ${money(a.spendToday)} (${pct(a.spendTodayDeltaPct)} vs ayer)`,
    `7d: ${money(a.spend7d)} (${pct(a.spend7dDeltaPct)} vs 7d previo)`,
    `30d: ${money(a.spend30d)}`,
    `En rango: ${money(a.spendInRange)} (${pct(a.spendRangeDeltaPct)} vs periodo previo)`,
    `Pacing: ${a.pacingLabel} (ratio ${a.pacingRatio?.toFixed(2) ?? "n/d"})`,
    `Días con actividad: ${a.daysWithActivity}`,
    `Datos hasta: ${a.dataThroughDate ?? "n/d"}`,
    "",
    "## Performance TikTok",
    a.perf.available
      ? `Imp ${a.perf.impressions} · Clicks ${a.perf.clicks} · Conv ${a.perf.conversions} · CTR ${a.perf.avgCtr?.toFixed(2) ?? "n/d"}% · CPC ${money(a.perf.avgCpc)} · CPM ${money(a.perf.avgCpm)}`
      : `Perf no disponible${a.perf.error ? `: ${a.perf.error}` : ""}`,
    "",
    "## COD / cobrado (tiendas)",
    `Tienda vinculada COD: ${a.hasCodLink ? "sí" : "no"}`,
    `Cobrado collected: ${money(a.collectedRevenue)} · Órdenes: ${a.ordersCollected}`,
    `ROAS collected: ${a.roasCollected?.toFixed(2) ?? "n/d"} · ROAS efectivo: ${a.roasEffective?.toFixed(2) ?? "n/d"}`,
    `Break-even ROAS (ads+fee ${a.feePercent}%): ${a.breakEvenRoas.toFixed(2)} · Sobre BE: ${a.aboveBreakEven == null ? "n/d" : a.aboveBreakEven ? "sí" : "no"}`,
    `CPA collected: ${money(a.cpaCollected)} · Ticket medio: ${money(a.avgOrderCollected)}`,
    stores.length
      ? `Tiendas: ${JSON.stringify(stores)}`
      : "Sin tiendas RealProfit vinculadas en snapshot.",
    "",
    "## Crédito / ops (gerencia)",
    `Cartera Holistic: ${money(ops.walletAvailableUsd)}`,
    `Saldo ledger cuentas: ${money(ops.adLedgerAvailableUsd)} (${ops.accountsWithLedgerBalance} con saldo)`,
    ops.lastAllocation
      ? `Última asignación: ${money(ops.lastAllocation.amountUsd)} → ${ops.lastAllocation.accountLabel} hace ${ops.lastAllocation.hoursAgo.toFixed(1)} h`
      : "Sin asignación reciente registrada",
    `Burn: ${ops.burn.status} (crit ${ops.burn.critical} / warn ${ops.burn.warn} / info ${ops.burn.info})`,
    `Hint crédito: ${ops.creditHint}`,
    `Cobros 90d depósitos: ${ops.collections.deposits90d ?? "n/d"} · fallidos: ${ops.collections.failedDeposits90d ?? "n/d"} · tickets abiertos: ${ops.collections.openTickets ?? "n/d"}`,
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
  ];

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

  const system = `Sos el asesor de gerencia Holistic para Real Profit / TikTok Ads.
Hablás con un GERENTE que está mirando la ficha de un cliente. Español claro, profesional, directo.
Solo usá los DATOS DEL CLIENTE que te paso abajo. Si falta un dato, decí “no figura en el snapshot”.
NO inventes montos, ROAS, cobros ni tickets. NO des consejos ilegales.
Priorizá: cómo va el cliente (riesgo), gasto/pacing, cobros, crédito, rendimiento (CTR/ROAS), qué hacer ahora.
Respuestas cortas (máx ~180 palabras) salvo que pidan detalle. Usá bullets cuando ayude.
Si preguntan algo fuera de este cliente (otros clientes, política interna secreta), redirigí a lo que sí tenés.

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
      temperature: 0.35,
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
