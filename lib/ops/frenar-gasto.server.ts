import "server-only";
import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";
import { setSharedBmAdvertiserBudgetAbsolute } from "@/lib/integrations/tiktok/bc-finance.server";
import { serverEnv } from "@/lib/env/env.server";

/**
 * Frenar gasto desde Monitoreo (gerencia):
 * - Bajar saldo: BM10/30 baja el cupo (nunca por debajo de lo gastado);
 *   BM200/300 devuelve cash al BM (REFUND).
 * - Congelar: pausa campañas y deja la cuenta en $0 para gastar.
 * No toca Hecom ni la cartera: lo pagado sigue a favor del cliente.
 * Misma lógica que scripts/_congelar-cliente.mjs y el guardián de congelados.
 */

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";
const SHARED_BMS = new Set(["10", "30"]);
/** TikTok no acepta presupuesto = gastado si la cuenta sigue entregando. */
const SPENT_MARGIN_USD = 0.1;
/** BM200 es multi-PA: el REFUND necesita el portfolio. */
const PORTFOLIO_BY_BM: Record<string, string> = { "200": "7654590612498563857" };
const CAMPAIGN_BATCH = 20;

export type FrenarResult = {
  advertiserId: string;
  ok: boolean;
  /** USD que se le quitó para gastar. */
  removedUsd: number;
  /** Lo que puede gastar ahora (null si no se pudo leer). */
  leftUsd: number | null;
  pausedCampaigns?: number;
  message: string;
};

type LiveRow = { budget: number; cost: number; mode: string; cash: number; name: string };

const round2 = (v: number) => Math.round(v * 100) / 100;
const floor2 = (v: number) => Math.floor(v * 100) / 100;

function token(): string {
  const t = serverEnv.tiktokAccessToken.trim();
  if (!t) throw new Error("Falta TIKTOK_ACCESS_TOKEN.");
  return t;
}

/** IDs grandes como texto exacto. */
function parse(text: string): Record<string, unknown> {
  return JSON.parse(text, (k, v, ctx?: { source?: string }) =>
    typeof v === "number" && /_id$/.test(k) && ctx?.source ? ctx.source : v,
  ) as Record<string, unknown>;
}

type TkResponse = {
  code?: number;
  message?: string;
  data?: { advertiser_account_list?: Array<Record<string, unknown>>; list?: Array<Record<string, unknown>> };
};

async function tk(path: string, body?: unknown): Promise<TkResponse> {
  const res = await fetch(`${TIKTOK_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Access-Token": token(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  return parse(await res.text()) as TkResponse;
}

async function readLive(bm: string, advertiserId: string): Promise<LiveRow> {
  const bc = HECOM_BM_BUCKET_TO_BC[bm];
  if (!bc) throw new Error(`BM${bm} desconocido.`);
  const j = await tk(
    `/advertiser/balance/get/?bc_id=${bc}&filtering=${encodeURIComponent(JSON.stringify({ keyword: advertiserId }))}&page_size=10`,
  );
  if (j.code !== 0) throw new Error(`TikTok: ${j.message ?? "no se pudo leer la cuenta"}`);
  const row = (j.data?.advertiser_account_list ?? []).find(
    (r) => String(r.advertiser_id) === advertiserId,
  );
  if (!row) throw new Error(`La cuenta no está en BM${bm}.`);
  return {
    budget: Number(row.budget) || 0,
    cost: Number(row.budget_cost) || 0,
    mode: String(row.budget_mode ?? "").toUpperCase(),
    cash: Number(row.valid_cash_balance ?? row.account_balance) || 0,
    name: String(row.advertiser_name ?? ""),
  };
}

/** Cupo nuevo; si TikTok dice que ya gastó más, reintenta con lo gastado + margen. */
async function setBudget(bm: string, advertiserId: string, target: number) {
  let want = round2(target);
  for (let attempt = 0; ; attempt++) {
    try {
      return await setSharedBmAdvertiserBudgetAbsolute({
        bcId: HECOM_BM_BUCKET_TO_BC[bm]!,
        advertiserId,
        budgetUsd: want,
        preferBudgetMode: "CUSTOM_BUDGET",
      });
    } catch (error) {
      const spent = Number(/([\d.]+) USD already spent/.exec(error instanceof Error ? error.message : "")?.[1]);
      if (!(spent > 0) || attempt >= 2) throw error;
      want = round2(spent + SPENT_MARGIN_USD * (attempt + 2));
    }
  }
}

/** Devuelve cash al BM. Si TikTok retiene parte, devuelve el máximo que deja. */
async function refund(bm: string, advertiserId: string, amount: number): Promise<number> {
  const send = (cash: number, suffix: string, withPortfolio: boolean) => {
    const body: Record<string, unknown> = {
      bc_id: HECOM_BM_BUCKET_TO_BC[bm],
      advertiser_id: advertiserId,
      transfer_type: "REFUND",
      cash_amount: cash,
      request_id: `frenar-${advertiserId}-${Date.now()}${suffix}`,
    };
    if (withPortfolio && PORTFOLIO_BY_BM[bm]) body.payment_portfolio_id = PORTFOLIO_BY_BM[bm];
    return tk("/bc/transfer/", body);
  };
  let r = await send(amount, "", true);
  if (r.code !== 0 && bm === "300") r = await send(amount, "-np", false);
  let sent = amount;
  if (r.code === 40002) {
    const max = floor2(Number(/maximum amount you can transfer out is ([\d.]+)/.exec(r.message ?? "")?.[1]));
    if (!(max > 0)) throw new Error("TikTok retiene ese saldo unas horas después de pausar. Intenta más tarde.");
    sent = Math.min(amount, max);
    r = await send(sent, "-max", true);
  }
  if (r.code !== 0) {
    if (/abnormal state/i.test(r.message ?? "")) throw new Error("Cuenta castigada: TikTok no deja devolver su saldo.");
    throw new Error(`TikTok: ${r.message ?? "no se pudo devolver"}`);
  }
  return sent;
}

/**
 * Le quita saldo para gastar a una cuenta.
 * amountUsd = null → todo (queda en $0 para gastar).
 */
export async function bajarSaldoCuenta(input: {
  bm: string;
  advertiserId: string;
  amountUsd: number | null;
}): Promise<FrenarResult> {
  const { bm, advertiserId } = input;
  const live = await readLive(bm, advertiserId);

  if (SHARED_BMS.has(bm)) {
    // Sin margen: si sigue gastando, setBudget reintenta con lo gastado + margen.
    const floor = round2(Math.ceil(live.cost * 100) / 100);
    const unlimited = live.mode === "UNLIMITED";
    const free = unlimited ? null : round2(Math.max(0, live.budget - live.cost));
    const target =
      input.amountUsd == null || unlimited ? floor : Math.max(floor, round2(live.budget - input.amountUsd));
    if (!unlimited && target >= live.budget - 0.005) {
      return { advertiserId, ok: true, removedUsd: 0, leftUsd: free, message: "Ya estaba sin cupo libre." };
    }
    const r = await setBudget(bm, advertiserId, target);
    const left = round2(Math.max(0, r.newBudget - live.cost));
    return {
      advertiserId,
      ok: true,
      removedUsd: unlimited ? 0 : round2(Math.max(0, (free ?? 0) - left)),
      leftUsd: left,
      message: unlimited ? `Tenía cupo sin tope; ahora puede gastar ${left.toFixed(2)}.` : `Cupo bajado a ${r.newBudget.toFixed(2)}.`,
    };
  }

  const cash = floor2(live.cash);
  const want = input.amountUsd == null ? cash : Math.min(cash, floor2(input.amountUsd));
  if (!(want > 0)) {
    return { advertiserId, ok: true, removedUsd: 0, leftUsd: cash, message: "No tenía saldo para devolver." };
  }
  const sent = await refund(bm, advertiserId, want);
  return {
    advertiserId,
    ok: true,
    removedUsd: sent,
    leftUsd: round2(cash - sent),
    message: sent < want ? `TikTok retiene ${(want - sent).toFixed(2)} por unas horas.` : "Saldo devuelto al BM.",
  };
}

/** Pausa todas las campañas activas de la cuenta. Devuelve cuántas pausó. */
async function pauseCampaigns(advertiserId: string): Promise<number> {
  const j = await tk(`/campaign/get/?advertiser_id=${advertiserId}&page_size=1000`);
  if (j.code !== 0) throw new Error(`TikTok campañas: ${j.message ?? "error"}`);
  const active = (j.data?.list ?? [])
    .filter((c) => c.operation_status === "ENABLE")
    .map((c) => String(c.campaign_id));
  for (let i = 0; i < active.length; i += CAMPAIGN_BATCH) {
    const r = await tk("/campaign/status/update/", {
      advertiser_id: advertiserId,
      campaign_ids: active.slice(i, i + CAMPAIGN_BATCH),
      operation_status: "DISABLE",
    });
    if (r.code !== 0) throw new Error(`TikTok al pausar: ${r.message ?? "error"}`);
  }
  return active.length;
}

/** Congela una cuenta: pausa campañas y la deja en $0 para gastar. */
export async function congelarCuenta(input: { bm: string; advertiserId: string }): Promise<FrenarResult> {
  let paused = 0;
  let pauseError = "";
  try {
    paused = await pauseCampaigns(input.advertiserId);
  } catch (error) {
    pauseError = error instanceof Error ? error.message : "No se pudieron pausar las campañas.";
  }
  // Pausar primero ayuda a que TikTok libere el cash; igual se intenta aunque falle la pausa.
  const r = await bajarSaldoCuenta({ ...input, amountUsd: null });
  return {
    ...r,
    pausedCampaigns: paused,
    message: [pauseError, paused ? `${paused} campaña(s) pausada(s).` : "", r.message].filter(Boolean).join(" "),
  };
}
