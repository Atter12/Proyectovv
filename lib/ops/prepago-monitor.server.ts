import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import { serverEnv } from "@/lib/env/env.server";
import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import type {
  MonitorAccount,
  MonitorCliente,
  MonitorEvent,
  MonitorSeverity,
  MonitorSignal,
  MonitorSnapshot,
} from "@/features/ops/types/prepago-monitor";

/**
 * Monitoreo de prepago para gerencia (solo lectura).
 *
 * Regla: en Ads Holistic quien recarga solo gasta lo que recargó. Aquí se
 * cruzan TikTok (lo que cada cuenta puede gastar), la cartera Holistic (lo
 * pagado), Hecom (cargo y cobros del mes) y los movimientos de saldo para
 * encontrar dónde alguien puede gastar o gastó plata que no pagó.
 *
 * Fugas que detecta (ver docs/PLAYBOOK_FRENAR_GASTO_CLIENTE.md):
 * - BM10/30 sin tope (UNLIMITED) o con más cupo que cartera.
 * - BM200/300 con cash en la cuenta sin cartera que lo respalde.
 * - Cargas de cash directo en el BC sin recarga en Holistic (72 h).
 * - «Recarga gerente» sin pago del cliente y cupo TikTok importado a cartera (7 días).
 * - Gasto que la cartera no descontó (cartera más alta que el cupo real).
 * - Deuda del mes en Hecom.
 */

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";
const SHARED_BMS = new Set(["10", "30"]);
const TOLERANCE_USD = 1;
const MANUAL_LOAD_HOURS = 72;
const STAFF_MOVES_DAYS = 7;
const CACHE_MS = 3 * 60_000;

let cache: { at: number; snapshot: MonitorSnapshot } | null = null;
let inflight: Promise<MonitorSnapshot> | null = null;

const round2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function getPrepagoMonitorSnapshot(
  options: { fresh?: boolean } = {},
): Promise<MonitorSnapshot> {
  if (!options.fresh && cache && Date.now() - cache.at < CACHE_MS) {
    return { ...cache.snapshot, cached: true };
  }
  if (inflight) return inflight;
  inflight = buildSnapshot()
    .then((snapshot) => {
      cache = { at: Date.now(), snapshot };
      return snapshot;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

type SelectQuery = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

/** Lee todas las filas (Supabase devuelve de a 1000). */
async function fetchAll<T>(
  client: SupabaseClient,
  table: string,
  select: string,
  apply: (q: SelectQuery) => SelectQuery = (q) => q,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await apply(client.from(table).select(select)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

type TikTokRow = {
  bm: string;
  bcId: string;
  advertiserId: string;
  name: string;
  status: string;
  portfolio: string;
  mode: string;
  budget: number;
  cost: number;
  cash: number;
};

async function tiktokJson(path: string, token: string) {
  const res = await fetch(`${TIKTOK_API}${path}`, {
    headers: { "Access-Token": token },
    cache: "no-store",
  });
  return (await res.json()) as {
    code?: number;
    message?: string;
    data?: Record<string, unknown> & { page_info?: { total_number?: number } };
  };
}

async function scanBc(bm: string, bcId: string, token: string): Promise<TikTokRow[]> {
  const out: TikTokRow[] = [];
  for (let page = 1; page <= 40; page++) {
    const json = await tiktokJson(
      `/advertiser/balance/get/?bc_id=${bcId}&page=${page}&page_size=50`,
      token,
    );
    if (json.code !== 0) throw new Error(`BM${bm}: ${json.message ?? "TikTok error"}`);
    const list = (json.data?.advertiser_account_list ?? []) as Array<Record<string, unknown>>;
    for (const r of list) {
      out.push({
        bm,
        bcId,
        advertiserId: String(r.advertiser_id ?? ""),
        name: String(r.advertiser_name ?? "").trim(),
        status: String(r.advertiser_status ?? ""),
        portfolio: String(r.payment_portfolio_type ?? "").toUpperCase(),
        mode: String(r.budget_mode ?? "").toUpperCase(),
        budget: num(r.budget),
        cost: num(r.budget_cost),
        cash: num(r.account_balance),
      });
    }
    if (page * 50 >= num(json.data?.page_info?.total_number)) break;
  }
  return out;
}

type BcTx = { id: string; advertiserId: string; type: string; amount: number; at: string };

/** Movimientos BC → cuenta de las últimas horas (hora del BC, Lima). */
async function scanBcTransactions(bcId: string, token: string, sinceLima: string): Promise<BcTx[]> {
  const out: BcTx[] = [];
  for (let page = 1; page <= 8; page++) {
    const qs = new URLSearchParams({
      bc_id: bcId,
      transaction_level: "ADVERTISER",
      page: String(page),
      page_size: "50",
    });
    const json = await tiktokJson(`/bc/account/transaction/get/?${qs}`, token);
    if (json.code !== 0) break;
    const list = (json.data?.transaction_list ?? json.data?.transactions ?? json.data?.list ?? []) as Array<
      Record<string, unknown>
    >;
    let last = "";
    for (const t of list) {
      const at = String(t.create_time ?? "");
      last = at;
      if (at < sinceLima) continue;
      out.push({
        id: String(t.transaction_id ?? `${t.account_id}:${at}:${t.amount}`),
        advertiserId: String(t.account_id ?? ""),
        type: String(t.transaction_type ?? ""),
        amount: num(t.amount),
        at,
      });
    }
    if (list.length < 50 || (last && last < sinceLima)) break;
  }
  return out;
}

function limaNowString(offsetHours = 0): string {
  const d = new Date(Date.now() - offsetHours * 3_600_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}:${get("second")}`;
}

/** "2026-09-29 16:03:29" (Lima) → ISO UTC. */
function limaToIso(value: string): string {
  const iso = value.replace(" ", "T");
  const d = new Date(`${iso}-05:00`);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

const SEVERITY_RANK: Record<MonitorSeverity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  info: 0,
};

function severityForAmount(usd: number, highFrom: number, criticalFrom: number): MonitorSeverity {
  if (usd >= criticalFrom) return "critical";
  if (usd >= highFrom) return "high";
  return "medium";
}

async function buildSnapshot(): Promise<MonitorSnapshot> {
  const started = Date.now();
  const token = serverEnv.tiktokAccessToken.trim();
  if (!token) throw new Error("Falta TIKTOK_ACCESS_TOKEN para leer TikTok.");
  const admin = createAdminClient() as unknown as SupabaseClient;
  const hecom = createHecomAdminClient();
  const warnings: string[] = [];

  const today = todayYmdInTz("America/Lima");
  const yesterday = shiftYmd(today, -1);
  const month = today.slice(0, 7);
  const sinceLoads = limaNowString(MANUAL_LOAD_HOURS);
  const sinceStaffIso = new Date(Date.now() - STAFF_MOVES_DAYS * 86_400_000).toISOString();
  const sinceLoadsIso = new Date(Date.now() - (MANUAL_LOAD_HOURS + 1) * 3_600_000).toISOString();

  const bcEntries = Object.entries(HECOM_BM_BUCKET_TO_BC);
  const cashBcs = bcEntries.filter(([bm]) => !SHARED_BMS.has(bm));

  const [
    links,
    pis,
    adAccounts,
    balances,
    staffJournals,
    allocJournals,
    clientes,
    hecomCuentas,
    gastosMes,
    cobrosMes,
    tiktokRows,
    bcTxs,
  ] = await Promise.all([
    fetchAll<{ hecom_cliente_id: string | null }>(admin, "hecom_cliente_user_links", "hecom_cliente_id"),
    fetchAll<{ hecom_cliente_id: string | null }>(
      admin,
      "payment_intents",
      "hecom_cliente_id:metadata->>hecom_cliente_id",
      (q) => q.eq("status", "succeeded"),
    ),
    fetchAll<{
      id: string;
      organization_id: string;
      name: string | null;
      external_account_id: string | null;
      hecom_cliente_id: string | null;
    }>(
      admin,
      "ad_accounts",
      "id,organization_id,name,external_account_id,hecom_cliente_id:metadata->>hecom_cliente_id",
      (q) => q.eq("platform", "tiktok"),
    ),
    fetchAll<{ ad_account_id: string; available_balance_cents: number | null }>(
      admin,
      "v_ad_account_ledger_balances",
      "ad_account_id,available_balance_cents",
    ),
    fetchAll<{
      id: string;
      created_at: string;
      organization_id: string;
      metadata: Record<string, unknown> | null;
    }>(admin, "ledger_journals", "id,created_at,organization_id,metadata", (q) =>
      q
        .gte("created_at", sinceStaffIso)
        .in("metadata->>source", ["agency_bm_bridge", "tiktok_balance_import"]),
    ),
    fetchAll<{ id: string; journal_type: string; metadata: Record<string, unknown> | null }>(
      admin,
      "ledger_journals",
      "id,journal_type,metadata",
      (q) =>
        q
          .gte("created_at", sinceLoadsIso)
          .in("journal_type", ["allocation_to_ad_account", "ad_account_refund_to_wallet"]),
    ),
    fetchAll<{ id: string; name: string | null }>(hecom, "clientes", "id,name"),
    fetchAll<{ client_id: string; advertiser_id: string | null; bm_bucket: string | null }>(
      hecom,
      "cliente_tiktok_cuentas",
      "client_id,advertiser_id,bm_bucket",
    ),
    fetchAll<{ client_id: string; gasto: number | null; fee: number | null; tiktok_stat_date: string | null }>(
      hecom,
      "gastos",
      "client_id,gasto,fee,tiktok_stat_date",
      (q) => q.eq("mes", month),
    ),
    fetchAll<{ client_id: string | null; monto: number | null }>(
      hecom,
      "cobros",
      "client_id,monto",
      (q) => q.eq("periodo_resumen", month),
    ),
    Promise.all(bcEntries.map(([bm, bcId]) => scanBc(bm, bcId, token))).then((r) => r.flat()),
    Promise.all(
      cashBcs.map(([bm, bcId]) =>
        scanBcTransactions(bcId, token, sinceLoads).catch((error) => {
          warnings.push(`Movimientos BM${bm}: ${error instanceof Error ? error.message : "error"}`);
          return [] as BcTx[];
        }),
      ),
    ).then((r) => {
      // La consulta de un BC también trae movimientos de los otros: una fila por transacción.
      const unique = new Map<string, BcTx>();
      for (const tx of r.flat()) unique.set(tx.id, tx);
      return [...unique.values()];
    }),
  ]);

  // ---- Quiénes son clientes Ads Holistic (login o algún pago acreditado)
  const withLogin = new Set(links.map((l) => String(l.hecom_cliente_id ?? "")).filter(Boolean));
  const adsIds = new Set([...withLogin, ...pis.map((p) => String(p.hecom_cliente_id ?? "")).filter(Boolean)]);
  const nameById = new Map(clientes.map((c) => [String(c.id), String(c.name ?? "").trim()]));

  // ---- Advertiser → cliente (Hecom manda; Holistic completa) y cartera por advertiser
  const clienteByAdv = new Map<string, string>();
  for (const c of hecomCuentas) {
    if (c.advertiser_id) clienteByAdv.set(String(c.advertiser_id), String(c.client_id));
  }
  const balanceByAd = new Map(balances.map((b) => [b.ad_account_id, num(b.available_balance_cents) / 100]));
  const ledgerByAdv = new Map<string, number>();
  for (const a of adAccounts) {
    const adv = String(a.external_account_id ?? "").trim();
    if (!adv) continue;
    if (a.hecom_cliente_id && !clienteByAdv.has(adv)) clienteByAdv.set(adv, String(a.hecom_cliente_id));
    ledgerByAdv.set(adv, num(ledgerByAdv.get(adv)) + Math.max(0, num(balanceByAd.get(a.id))));
  }

  // ---- Hecom: cargo y cobros del mes, gasto de ayer
  const cargoMes = new Map<string, number>();
  const gastoAyer = new Map<string, number>();
  for (const g of gastosMes) {
    const cargo = num(g.gasto) * (1 + num(g.fee) / 100);
    cargoMes.set(g.client_id, num(cargoMes.get(g.client_id)) + cargo);
    if (g.tiktok_stat_date === yesterday) gastoAyer.set(g.client_id, num(gastoAyer.get(g.client_id)) + cargo);
  }
  const cobradoMes = new Map<string, number>();
  for (const c of cobrosMes) {
    if (c.client_id) cobradoMes.set(c.client_id, num(cobradoMes.get(c.client_id)) + num(c.monto));
  }

  // ---- Cliente → estructura
  const byCliente = new Map<string, MonitorCliente>();
  const ensure = (cid: string): MonitorCliente => {
    let row = byCliente.get(cid);
    if (!row) {
      const cargo = round2(num(cargoMes.get(cid)));
      const cobrado = round2(num(cobradoMes.get(cid)));
      row = {
        id: cid,
        name: nameById.get(cid) || "Cliente sin nombre",
        hasLogin: withLogin.has(cid),
        severity: "info",
        exposureUsd: 0,
        walletUsd: 0,
        tiktokSpendableUsd: 0,
        unlimitedAccounts: 0,
        month: { chargeUsd: cargo, paidUsd: cobrado, debtUsd: round2(cargo - cobrado) },
        spendYesterdayUsd: round2(num(gastoAyer.get(cid))),
        signals: [],
        accounts: [],
      };
      byCliente.set(cid, row);
    }
    return row;
  };

  const tiktokByAdv = new Map<string, TikTokRow>();
  for (const t of tiktokRows) {
    const prev = tiktokByAdv.get(t.advertiserId);
    if (!prev || /APPROVED/.test(t.status)) tiktokByAdv.set(t.advertiserId, t);
  }

  for (const t of tiktokByAdv.values()) {
    const cid = clienteByAdv.get(t.advertiserId);
    if (!cid || !adsIds.has(cid)) continue;
    const cliente = ensure(cid);
    const shared = t.portfolio === "SHARED" || SHARED_BMS.has(t.bm);
    const banned = /PUNISH|DISABLE|BAN|CLOSE|LIMIT/i.test(t.status);
    const unlimited = shared && t.mode === "UNLIMITED";
    const wallet = round2(num(ledgerByAdv.get(t.advertiserId)));
    const spendable = unlimited ? null : round2(shared ? Math.max(0, t.budget - t.cost) : t.cash);
    const excess = unlimited ? null : round2(Math.max(0, (spendable ?? 0) - wallet));
    const phantom = shared && !unlimited ? round2(Math.max(0, wallet - (spendable ?? 0))) : 0;

    const account: MonitorAccount = {
      advertiserId: t.advertiserId,
      name: t.name,
      bm: t.bm,
      kind: shared ? "shared" : "cash",
      status: banned ? "banned" : /APPROVED/.test(t.status) ? "active" : "other",
      unlimited,
      spendableUsd: spendable,
      walletUsd: wallet,
      excessUsd: excess,
      spentTotalUsd: round2(t.cost),
    };
    cliente.accounts.push(account);
    cliente.walletUsd = round2(cliente.walletUsd + wallet);
    if (!banned) cliente.tiktokSpendableUsd = round2(cliente.tiktokSpendableUsd + (spendable ?? 0));

    if (unlimited && !banned) {
      cliente.unlimitedAccounts += 1;
      cliente.signals.push({
        kind: "unlimited",
        severity: "critical",
        title: "Cuenta sin tope en TikTok",
        detail: `${t.name} (BM${t.bm}) está en ilimitado: puede gastar sin límite aunque no haya pagado.`,
        action: "Abrir la cuenta en Ads Holistic para que el tope la baje, o fijar el presupuesto en TikTok.",
        advertiserId: t.advertiserId,
        amountUsd: null,
      });
    } else if (!banned && excess != null && excess > TOLERANCE_USD) {
      cliente.exposureUsd = round2(cliente.exposureUsd + excess);
      cliente.signals.push(
        shared
          ? {
              kind: "budget_over_wallet",
              severity: severityForAmount(excess, 20, 100),
              title: "Más cupo que cartera",
              detail: `${t.name} (BM${t.bm}) puede gastar $${spendable?.toFixed(2)} y en cartera tiene $${wallet.toFixed(2)}.`,
              action: "Bajar el presupuesto a gastado + cartera (abrir la cuenta aplica el tope).",
              advertiserId: t.advertiserId,
              amountUsd: excess,
            }
          : {
              kind: "cash_without_wallet",
              severity: severityForAmount(excess, 20, 100),
              title: "Saldo en TikTok sin pago detrás",
              detail: `${t.name} (BM${t.bm}) tiene $${t.cash.toFixed(2)} de cash y en cartera $${wallet.toFixed(2)}.`,
              action: "Confirmar quién cargó ese saldo. Si no hay pago: pausar y devolver al BM.",
              advertiserId: t.advertiserId,
              amountUsd: excess,
            },
      );
    }
    if (phantom > 20 && !banned) {
      cliente.signals.push({
        kind: "unrecorded_spend",
        severity: "info",
        title: "Gasto sin descontar de la cartera",
        detail: `${t.name}: la cartera dice $${wallet.toFixed(2)} pero en TikTok le quedan $${(spendable ?? 0).toFixed(2)}.`,
        action: "No da cupo extra (el tope solo baja). Tenerlo en cuenta antes de devolverle saldo.",
        advertiserId: t.advertiserId,
        amountUsd: phantom,
      });
    }
  }

  // ---- Movimientos: plata nueva en cuentas cash (BM200/300) sin pasar por Ads Holistic (72 h).
  // Por cliente: neto TikTok (cargas − retiros) − neto Holistic (recargas − recuperaciones).
  // Así un traspaso entre sus propias cuentas no cuenta como plata nueva.
  const isCashAdv = (adv: string) => {
    const bm = tiktokByAdv.get(adv)?.bm;
    return Boolean(bm && !SHARED_BMS.has(bm));
  };
  const refundIds = allocJournals.filter((j) => j.journal_type === "ad_account_refund_to_wallet").map((j) => j.id);
  const refundAmount = new Map<string, number>();
  for (let i = 0; i < refundIds.length; i += 200) {
    const { data } = await admin
      .from("ledger_entries")
      .select("journal_id,amount_cents")
      .in("journal_id", refundIds.slice(i, i + 200))
      .eq("direction", "debit");
    for (const e of (data ?? []) as Array<{ journal_id: string; amount_cents: number }>) {
      refundAmount.set(e.journal_id, Math.max(num(refundAmount.get(e.journal_id)), num(e.amount_cents) / 100));
    }
  }
  const holisticNetByCliente = new Map<string, number>();
  for (const j of allocJournals) {
    const adv = String(j.metadata?.tiktok_advertiser_id ?? "");
    const cid = clienteByAdv.get(adv);
    if (!adv || !cid || !isCashAdv(adv)) continue;
    const amount =
      j.journal_type === "allocation_to_ad_account"
        ? num(j.metadata?.tiktok_amount_cents) / 100
        : -num(refundAmount.get(j.id));
    holisticNetByCliente.set(cid, num(holisticNetByCliente.get(cid)) + amount);
  }
  const bcByCliente = new Map<string, { net: number; loads: BcTx[] }>();
  for (const tx of bcTxs) {
    const cid = clienteByAdv.get(tx.advertiserId);
    if (!cid || !adsIds.has(cid)) continue;
    const row = bcByCliente.get(cid) ?? { net: 0, loads: [] };
    const increase = /INCREASE/i.test(tx.type);
    row.net += increase ? tx.amount : -tx.amount;
    if (increase) row.loads.push(tx);
    bcByCliente.set(cid, row);
  }
  const events: MonitorEvent[] = [];
  for (const [cid, row] of bcByCliente) {
    const viaHolistic = round2(num(holisticNetByCliente.get(cid)));
    const unexplained = round2(row.net - viaHolistic);
    if (unexplained <= 5 || row.loads.length === 0) continue;
    const cliente = ensure(cid);
    const perAccount = new Map<string, number>();
    for (const t of row.loads) perAccount.set(t.advertiserId, num(perAccount.get(t.advertiserId)) + t.amount);
    const topAccounts = [...perAccount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([adv, v]) => `${tiktokByAdv.get(adv)?.name ?? adv} $${round2(v).toFixed(2)}`)
      .join(" · ");
    const lastAt = row.loads.map((t) => t.at).sort().at(-1) ?? "";
    const severity = severityForAmount(unexplained, 20, 100);
    cliente.signals.push({
      kind: "manual_bc_load",
      severity,
      title: "Carga directa en TikTok",
      detail: `En las últimas ${MANUAL_LOAD_HOURS} h entró $${round2(row.net).toFixed(2)} neto a sus cuentas cash y por Ads Holistic pasó $${viaHolistic.toFixed(2)}.`,
      action: "Revisar en el Business Center quién la hizo y si hubo pago.",
      advertiserId: null,
      amountUsd: unexplained,
    });
    events.push({
      id: `bc:${cid}:${lastAt}`,
      at: limaToIso(lastAt),
      kind: "manual_bc_load",
      severity,
      clienteId: cid,
      clienteName: cliente.name,
      title: "Carga directa en TikTok sin pago en Ads Holistic",
      detail: `$${unexplained.toFixed(2)} sin pasar por Ads Holistic (${row.loads.length} carga${row.loads.length === 1 ? "" : "s"}): ${topAccounts}.`,
      amountUsd: unexplained,
      actor: null,
    });
  }

  // ---- Movimientos de staff: recarga gerente sin pago e import de cupo TikTok (7 días)
  const orgToCliente = new Map<string, string>();
  const adIdToCliente = new Map<string, string>();
  for (const a of adAccounts) {
    const cid = a.hecom_cliente_id ? String(a.hecom_cliente_id) : clienteByAdv.get(String(a.external_account_id ?? ""));
    if (cid) adIdToCliente.set(a.id, cid);
  }
  for (const a of adAccounts) {
    const cid = adIdToCliente.get(a.id);
    if (cid && !orgToCliente.has(a.organization_id)) orgToCliente.set(a.organization_id, cid);
  }
  const { data: staffEntries } = staffJournals.length
    ? await admin
        .from("ledger_entries")
        .select("journal_id,amount_cents,direction")
        .in("journal_id", staffJournals.map((j) => j.id))
        .eq("direction", "debit")
    : { data: [] as Array<{ journal_id: string; amount_cents: number }> };
  const amountByJournal = new Map<string, number>();
  for (const e of staffEntries ?? []) {
    amountByJournal.set(e.journal_id, Math.max(num(amountByJournal.get(e.journal_id)), num(e.amount_cents) / 100));
  }
  const actorIds = new Set<string>();
  for (const j of staffJournals) {
    const who = String(j.metadata?.funded_by ?? j.metadata?.requested_by ?? "");
    if (who) actorIds.add(who);
  }
  const actorEmail = new Map<string, string>();
  await Promise.all(
    [...actorIds].slice(0, 20).map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id).catch(() => ({ data: null }));
      if (data?.user?.email) actorEmail.set(id, data.user.email);
    }),
  );
  const staffTotals = new Map<string, { bridge: number; imported: number }>();
  for (const j of staffJournals) {
    const source = String(j.metadata?.source ?? "");
    const adId = String(j.metadata?.ad_account_id ?? "");
    const cid = (adId && adIdToCliente.get(adId)) || orgToCliente.get(j.organization_id);
    if (!cid || !adsIds.has(cid)) continue;
    const amount = round2(num(amountByJournal.get(j.id)));
    if (amount <= 0) continue;
    const cliente = ensure(cid);
    const who = String(j.metadata?.funded_by ?? j.metadata?.requested_by ?? "");
    const actor = actorEmail.get(who) ?? null;
    const bridge = source === "agency_bm_bridge";
    const totals = staffTotals.get(cid) ?? { bridge: 0, imported: 0 };
    if (bridge) totals.bridge += amount;
    else totals.imported += amount;
    staffTotals.set(cid, totals);
    events.push({
      id: `j:${j.id}`,
      at: j.created_at,
      kind: bridge ? "staff_recharge" : "tiktok_import",
      severity: amount >= 100 ? "high" : "medium",
      clienteId: cid,
      clienteName: cliente.name,
      title: bridge ? "Recarga gerente sin pago del cliente" : "Cupo de TikTok pasado a cartera",
      detail: bridge
        ? `$${amount.toFixed(2)} cargados desde el BM sin recarga del cliente.`
        : `$${amount.toFixed(2)} de saldo TikTok acreditados en cartera como si estuvieran pagados.`,
      amountUsd: amount,
      actor,
    });
  }
  for (const [cid, totals] of staffTotals) {
    const cliente = ensure(cid);
    if (totals.bridge > 0) {
      cliente.signals.push({
        kind: "staff_recharge",
        severity: totals.bridge >= 100 ? "high" : "medium",
        title: "Recargas de gerente sin pago",
        detail: `$${round2(totals.bridge).toFixed(2)} en los últimos ${STAFF_MOVES_DAYS} días.`,
        action: "Confirmar que hay un pago o acuerdo detrás; si no, es crédito.",
        advertiserId: null,
        amountUsd: round2(totals.bridge),
      });
    }
    if (totals.imported > 0) {
      cliente.signals.push({
        kind: "tiktok_import",
        severity: totals.imported >= 100 ? "high" : "medium",
        title: "Cupo TikTok convertido en cartera",
        detail: `$${round2(totals.imported).toFixed(2)} en los últimos ${STAFF_MOVES_DAYS} días (transferencias).`,
        action: "Revisar la transferencia: ese saldo no vino de un pago.",
        advertiserId: null,
        amountUsd: round2(totals.imported),
      });
    }
  }

  // ---- Deuda del mes
  for (const cliente of byCliente.values()) {
    const debt = cliente.month.debtUsd;
    if (debt > TOLERANCE_USD) {
      cliente.signals.push({
        kind: "month_debt",
        severity: debt >= 500 ? "critical" : debt >= 100 ? "high" : "medium",
        title: "Gastó más de lo que pagó este mes",
        detail: `Cargo $${cliente.month.chargeUsd.toFixed(2)} − cobrado $${cliente.month.paidUsd.toFixed(2)}.`,
        action: "Cobrar la diferencia y revisar de dónde salió el saldo.",
        advertiserId: null,
        amountUsd: debt,
      });
    }
  }

  // ---- Severidad por cliente y orden
  for (const cliente of byCliente.values()) {
    cliente.signals.sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || num(b.amountUsd) - num(a.amountUsd),
    );
    const worst = cliente.signals.find((s) => s.severity !== "info")?.severity ?? "info";
    cliente.severity = worst;
    cliente.accounts.sort((a, b) => num(b.excessUsd) - num(a.excessUsd) || a.name.localeCompare(b.name));
  }
  const clientesList = [...byCliente.values()].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      b.exposureUsd + Math.max(0, b.month.debtUsd) - (a.exposureUsd + Math.max(0, a.month.debtUsd)),
  );
  events.sort((a, b) => (a.at < b.at ? 1 : -1));

  const signals: MonitorSignal[] = clientesList.flatMap((c) => c.signals);
  const count = (sev: MonitorSeverity) => clientesList.filter((c) => c.severity === sev).length;

  return {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    cached: false,
    month,
    windows: { manualLoadHours: MANUAL_LOAD_HOURS, staffMovesDays: STAFF_MOVES_DAYS },
    totals: {
      clientes: clientesList.length,
      accounts: clientesList.reduce((s, c) => s + c.accounts.length, 0),
      critical: count("critical"),
      high: count("high"),
      medium: count("medium"),
      ok: count("info"),
      exposureUsd: round2(clientesList.reduce((s, c) => s + c.exposureUsd, 0)),
      unlimitedAccounts: clientesList.reduce((s, c) => s + c.unlimitedAccounts, 0),
      monthDebtUsd: round2(clientesList.reduce((s, c) => s + Math.max(0, c.month.debtUsd), 0)),
      staffRechargeUsd: round2(
        signals.filter((s) => s.kind === "staff_recharge").reduce((s, x) => s + num(x.amountUsd), 0),
      ),
      manualLoadUsd: round2(
        signals.filter((s) => s.kind === "manual_bc_load").reduce((s, x) => s + num(x.amountUsd), 0),
      ),
      tiktokImportUsd: round2(
        signals.filter((s) => s.kind === "tiktok_import").reduce((s, x) => s + num(x.amountUsd), 0),
      ),
    },
    clientes: clientesList,
    events: events.slice(0, 80),
    warnings,
  };
}
