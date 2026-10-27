import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";
import { isAgencyCreditCliente } from "@/lib/hecom/is-agency-credit-cliente.server";
import { sendTransactionalEmail } from "@/lib/email/email.server";
import { resolveManualPaymentManagerEmails } from "@/lib/email/manual-payment-notify.server";
import { escapeHtml, wrapInternalEmail } from "@/lib/email/templates/layout";
import {
  getAdvertiserBudgetSnapshot,
  setSharedBmAdvertiserBudgetAbsolute,
} from "@/lib/integrations/tiktok/bc-finance.server";
import { bajarSaldoCuenta, readLive } from "@/lib/ops/frenar-gasto.server";

/**
 * Guardián de prepago (cron cada 15 min).
 *
 * En Ads Holistic todo cliente es prepago: lo que puede gastar en TikTok
 * (presupuesto − gastado) no debe superar su saldo en cartera. Hoy el tope
 * solo se aplica al recargar o al abrir la cuenta en vivo; entre esos
 * momentos un cambio en TikTok o un error de configuración deja gastar de más.
 *
 * Modo "enforce" (default): si una cuenta puede gastar más de lo que respalda
 * lo asignado desde la cartera, baja su presupuesto en TikTok a
 * gastado + saldo asignado y avisa lo que hizo. Nunca sube presupuestos: eso
 * solo pasa al asignar saldo desde la cartera, que es el flujo correcto.
 * PREPAGO_GUARD_MODE=alert lo deja en solo aviso (sin escribir en TikTok).
 */

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";
/** BM con presupuesto compartido (SHARED): ahí el cupo lo fija la agencia. */
const SHARED_BUCKETS = ["10", "30"] as const;
/** Margen para no avisar por centavos. */
const TOLERANCE_USD = 1;
/**
 * Si algo no se pudo corregir, se vuelve a avisar cada hora. La ventana es
 * 55 min porque las revisiones van cada 15: con 60 exactos salía cada 1 h 15.
 */
const REALERT_AFTER_HOURS = 55 / 60;
/**
 * Freno de emergencia: con más cuentas que esto en una misma revisión no se
 * corrige ninguna. Un número así suele ser una falla (saldos que no cargaron),
 * no errores reales, y no queremos cortar el presupuesto de todos.
 */
const MAX_CORRECTIONS_PER_RUN = 10;
/**
 * Clientes con crédito confirmado por gerencia: pueden gastar sin saldo
 * asignado, así que el guardián no los revisa. Se suman los de
 * PREPAGO_GUARD_CREDIT_HECOM_IDS (coma).
 */
const CONFIRMED_CREDIT_CLIENTES = new Set<string>([
  // Julio Lirio: crédito confirmado (01/10/2026).
  "d6121f78-5eb3-42e3-b8d8-e3727c434f2c",
  // Wilder Remolina: gerencia le devolvió $309.78 de cupo a crédito tras pagar setiembre;
  // lo paga después (12/10/2026). Sacarlo de aquí cuando pague octubre.
  "afb12eff-76b7-4149-81be-62d047960527",
  // Fabian Hoyos - Colombia: USD 1,500 a crédito en su cuenta 204.0 por orden del usuario (20/10/2026).
  "4e509277-8c50-47fc-95a8-830453d1a5b8",
  // Confianza por orden del usuario (27/10/2026): gerencia les recarga directo en el BC.
  "1fb61f89-d270-469d-a516-a980d616a233", // Jesús Jiménez
  "8191ad11-d421-4e5a-8758-91d93d22a4a5", // Yim Villar
  "826bf4f1-70b0-4be5-9757-e1a48e19e3e2", // Renzo Cruz
  "95ac1a7b-6906-4275-81c1-8af8f8cabfb1", // Luis Miguel Gomez
  "7a54cf3b-bae3-4a5d-9778-75fdd971950a", // Benchi Quispe Tacuri
  ...`${process.env.PREPAGO_GUARD_CREDIT_HECOM_IDS ?? ""},${process.env.PREPAGO_GUARD_EXCLUDE_HECOM_IDS ?? ""}`
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean),
]);
/**
 * Regla para todos los clientes de Ads (27/10/2026): solo gastan lo que asignan
 * desde su cartera. Una recarga directa en el BC (BM200/300) que no hizo Ads
 * Holistic se devuelve al BM; en BM10/30 el cupo se baja como siempre.
 * Para dar crédito a alguien se lo agrega a CONFIRMED_CREDIT_CLIENTES, no se le
 * recarga a mano.
 *
 * Solo cuentan recargas desde DIRECT_RECHARGE_SINCE (lo anterior ya fue acordado,
 * ej. los $600 de Yolmer del 26/10). Hasta RULE_ENFORCE_FROM es solo aviso para
 * todos; desde ahí corrige siempre, salvo PREPAGO_GUARD_MODE=pause.
 */
const DIRECT_RECHARGE_SINCE = Date.parse("2026-10-27T21:00:00Z");
const RULE_ENFORCE_FROM = Date.parse("2026-10-29T05:00:00Z"); // 29/10 00:00 Lima
/** Cainan Aguirre ya estaba con la regla antes del arranque general (27/10/2026). */
const ENFORCED_EARLY = new Set<string>(["63bdf982-43b2-411f-9410-64af4e5a527b"]);
/** Ventana de transacciones que se revisa en cada corrida (corre cada 15 min). */
const RECHARGE_LOOKBACK_MS = 6 * 3_600_000;
/** Una asignación de Ads y su recarga en TikTok caen a minutos de distancia. */
const MATCH_WINDOW_MS = 20 * 60_000;
/** No se mueven montos menores (centavos de redondeo). */
const MIN_DIRECT_RECHARGE_USD = 5;
/** BM donde cada cuenta tiene su propio cash. */
const CASH_BUCKETS = ["200", "300"] as const;
const MANAGER_EMAILS_PER_SECOND = 2;
const AUDIT_ACTION = "prepago_guard.run";
/** Correo de prueba que se envía una sola vez, en la primera revisión en producción. */
const PREVIEW_ACTION = "prepago_guard.preview_sent";
const PREVIEW_TO = ["lizarzaburusebastian046@gmail.com"];

export type PrepagoGuardMode = "alert" | "enforce";

function resolveGuardMode(): PrepagoGuardMode {
  const env = String(process.env.PREPAGO_GUARD_MODE ?? "").trim().toLowerCase();
  if (env === "pause") return "alert";
  if (Date.now() >= RULE_ENFORCE_FROM) return "enforce";
  return env === "alert" ? "alert" : "enforce";
}

export type PrepagoGuardIncident = {
  /** direct_recharge: BM200/300, recarga en el BC que no vino de una asignación de Ads. */
  kind: "budget_over_balance" | "direct_recharge" | "credit_without_approval";
  /** Se corrige aunque el guardián esté en modo aviso (ENFORCED_EARLY). */
  enforcedEarly?: boolean;
  /** direct_recharge: la transacción de TikTok, cuándo y cuánto. */
  transactionId?: string;
  rechargedAt?: string;
  rechargeUsd?: number;
  hecomClienteId: string;
  clienteName: string;
  advertiserId?: string;
  advertiserName?: string;
  bm?: string;
  /** Lo que TikTok deja gastar hoy (presupuesto − gastado). */
  tiktokRemainingUsd?: number;
  ledgerUsd?: number;
  /** Cuánto de más puede gastar respecto a su saldo. */
  excessUsd?: number;
  unlimited?: boolean;
  /** Presupuesto que debería tener: gastado + saldo. */
  targetBudgetUsd?: number;
  /** Lo ya gastado según TikTok (base del presupuesto). */
  costUsd?: number;
  /** BC de TikTok donde vive la cuenta (para corregir). */
  bcId?: string;
  /** Filas de ad_accounts de este advertiser (para releer el saldo al corregir). */
  adAccountIds?: string[];
  organizationId?: string;
  /** Resultado de la corrección automática. */
  correction?: {
    status:
      | "corrected"
      | "failed"
      | "skipped_alert_mode"
      | "skipped_circuit_breaker"
      /** Al releer en vivo ya estaba en orden: no se toca ni se avisa. */
      | "not_needed";
    previousBudgetUsd?: number;
    newBudgetUsd?: number;
    /** direct_recharge: lo devuelto al BM. */
    refundedUsd?: number;
    error?: string;
  };
};

export type PrepagoGuardResult = {
  mode: PrepagoGuardMode;
  scannedAdvertisers: number;
  adsClientes: number;
  incidents: PrepagoGuardIncident[];
  alerted: boolean;
  alertReason: string;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Lee todas las filas (Supabase devuelve de a 1000). `eq` filtra por igualdad. */
async function fetchAllRows<T>(
  table: string,
  select: string,
  eq: Record<string, string> = {},
): Promise<T[]> {
  const admin = createAdminClient();
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let query = admin.from(table).select(select);
    for (const [column, value] of Object.entries(eq)) query = query.eq(column, value);
    const { data, error } = await query.range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** Clientes Hecom que usan Ads Holistic: login vinculado o algún pago acreditado. */
async function loadAdsClienteIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const links = await fetchAllRows<{ hecom_cliente_id: string | null }>(
    "hecom_cliente_user_links",
    "hecom_cliente_id",
  );
  for (const l of links) if (l.hecom_cliente_id) ids.add(String(l.hecom_cliente_id));
  const payments = await fetchAllRows<{ hecom_cliente_id: string | null }>(
    "payment_intents",
    "hecom_cliente_id:metadata->>hecom_cliente_id",
    { status: "succeeded" },
  );
  for (const p of payments) if (p.hecom_cliente_id) ids.add(String(p.hecom_cliente_id));
  return ids;
}

type TikTokBudgetRow = {
  bm: string;
  advertiserId: string;
  name: string;
  budget: number;
  cost: number;
  mode: string;
};

async function scanBc(bm: string, bcId: string, token: string): Promise<TikTokBudgetRow[]> {
  const out: TikTokBudgetRow[] = [];
  for (let page = 1; page <= 40; page++) {
    const url = `${TIKTOK_API}/advertiser/balance/get/?bc_id=${bcId}&page=${page}&page_size=50`;
    const res = await fetch(url, { headers: { "Access-Token": token } });
    const json = (await res.json()) as {
      code?: number;
      message?: string;
      data?: {
        advertiser_account_list?: Array<Record<string, unknown>>;
        page_info?: { total_number?: number };
      };
    };
    if (json.code !== 0) throw new Error(`BM${bm}: ${json.message ?? "TikTok error"}`);
    for (const r of json.data?.advertiser_account_list ?? []) {
      out.push({
        bm,
        advertiserId: String(r.advertiser_id ?? ""),
        name: String(r.advertiser_name ?? ""),
        budget: Number(r.budget) || 0,
        cost: Number(r.budget_cost) || 0,
        mode: String(r.budget_mode ?? "").toUpperCase(),
      });
    }
    if (page * 50 >= (json.data?.page_info?.total_number ?? 0)) break;
  }
  return out;
}

export async function runPrepagoGuard(
  options: { notify?: boolean; record?: boolean; apply?: boolean } = {},
): Promise<PrepagoGuardResult> {
  // notify/record en false = prueba local: solo detecta, no avisa ni registra.
  const notify = options.notify !== false;
  const record = options.record !== false;
  const apply = options.apply ?? notify;
  const token = serverEnv.tiktokAccessToken.trim();
  if (!token) throw new Error("Falta TIKTOK_ACCESS_TOKEN para leer presupuestos.");

  const adsClienteIds = await loadAdsClienteIds();

  // Cuenta TikTok → cliente Hecom y su saldo asignado. Una misma cuenta tiene
  // filas en varias organizaciones (la del cliente y las del staff) y desde
  // cualquiera se puede asignar: TikTok tiene un solo presupuesto que alimentan
  // todas, así que el saldo que lo respalda es la suma de todas las filas.
  const adAccounts = await fetchAllRows<{
    id: string;
    organization_id: string;
    name: string | null;
    external_account_id: string | null;
    hecom_cliente_id: string | null;
    hecom_cliente_name: string | null;
  }>(
    "ad_accounts",
    "id,organization_id,name,external_account_id,hecom_cliente_id:metadata->>hecom_cliente_id,hecom_cliente_name:metadata->>hecom_cliente_name",
    { platform: "tiktok" },
  );
  const balances = await fetchAllRows<{ ad_account_id: string; available_balance_cents: number | null }>(
    "v_ad_account_ledger_balances",
    "ad_account_id,available_balance_cents",
  );
  const balanceByAdAccount = new Map(
    balances.map((b) => [b.ad_account_id, Math.max(0, (Number(b.available_balance_cents) || 0) / 100)]),
  );

  const rowsByAdvertiser = new Map<string, typeof adAccounts>();
  for (const a of adAccounts) {
    const adv = String(a.external_account_id ?? "").trim();
    if (!adv) continue;
    const list = rowsByAdvertiser.get(adv) ?? [];
    list.push(a);
    rowsByAdvertiser.set(adv, list);
  }

  const byAdvertiser = new Map<
    string,
    {
      ledgerUsd: number;
      hecomId: string;
      clienteName: string;
      organizationId: string;
      adAccountIds: string[];
    }
  >();
  for (const [adv, rows] of rowsByAdvertiser) {
    const tagged = rows.find((a) => a.hecom_cliente_id);
    if (!tagged) continue;
    const hecomId = String(tagged.hecom_cliente_id);
    if (!adsClienteIds.has(hecomId)) continue;
    if (CONFIRMED_CREDIT_CLIENTES.has(hecomId.toLowerCase())) continue;
    const withBalance = rows.map((a) => ({ a, usd: balanceByAdAccount.get(a.id) ?? 0 }));
    // Para corregir en TikTok se usa la organización de la fila con más saldo.
    const main = withBalance.reduce((best, x) => (x.usd > best.usd ? x : best), withBalance[0]!);
    byAdvertiser.set(adv, {
      ledgerUsd: round2(withBalance.reduce((sum, x) => sum + x.usd, 0)),
      hecomId,
      clienteName: tagged.hecom_cliente_name || tagged.name || hecomId,
      organizationId: main.a.organization_id,
      adAccountIds: rows.map((a) => a.id),
    });
  }

  const tiktokRows: TikTokBudgetRow[] = [];
  for (const bm of SHARED_BUCKETS) {
    const bcId = HECOM_BM_BUCKET_TO_BC[bm];
    if (bcId) tiktokRows.push(...(await scanBc(bm, bcId, token)));
  }

  const incidents: PrepagoGuardIncident[] = [];
  const clientesSeen = new Map<string, string>();

  for (const row of tiktokRows) {
    const holistic = byAdvertiser.get(row.advertiserId);
    if (!holistic) continue;
    const clienteName = holistic.clienteName;
    clientesSeen.set(holistic.hecomId, clienteName);

    const unlimited = row.mode === "UNLIMITED";
    const remaining = round2(row.budget - row.cost);
    const excess = round2(remaining - holistic.ledgerUsd);
    if (!unlimited && excess <= TOLERANCE_USD) continue;

    incidents.push({
      kind: "budget_over_balance",
      hecomClienteId: holistic.hecomId,
      clienteName,
      advertiserId: row.advertiserId,
      advertiserName: row.name,
      bm: row.bm,
      tiktokRemainingUsd: unlimited ? undefined : remaining,
      ledgerUsd: round2(holistic.ledgerUsd),
      excessUsd: unlimited ? undefined : excess,
      unlimited,
      targetBudgetUsd: round2(row.cost + holistic.ledgerUsd),
      costUsd: round2(row.cost),
      bcId: HECOM_BM_BUCKET_TO_BC[row.bm],
      organizationId: holistic.organizationId,
      adAccountIds: holistic.adAccountIds,
      enforcedEarly: ENFORCED_EARLY.has(holistic.hecomId.toLowerCase()),
    });
  }

  // BM200/300: recargas directas en el BC que no vinieron de una asignación de Ads.
  for (const i of await findDirectRecharges(byAdvertiser, token)) {
    clientesSeen.set(i.hecomClienteId, i.clienteName);
    incidents.push(i);
  }

  // Red de seguridad: en Ads nadie debe ser crédito sin aprobación de gerencia.
  // Hoy no existe crédito aprobado en Ads, así que cualquier caso es un error.
  for (const [hecomId, clienteName] of clientesSeen) {
    if (await isAgencyCreditCliente(hecomId)) {
      incidents.push({ kind: "credit_without_approval", hecomClienteId: hecomId, clienteName });
    }
  }

  incidents.sort((a, b) => (b.unlimited ? 1e9 : b.excessUsd ?? 0) - (a.unlimited ? 1e9 : a.excessUsd ?? 0));

  const mode = resolveGuardMode();
  await correctIncidents(incidents, mode, apply);
  // Lo que al releer en vivo ya estaba en orden no es incidente.
  for (let i = incidents.length - 1; i >= 0; i--) {
    if (incidents[i]!.correction?.status === "not_needed") incidents.splice(i, 1);
  }

  const { alerted, reason } = notify
    ? await alertIfNeeded(incidents, mode)
    : { alerted: false, reason: "prueba_sin_aviso" };
  if (notify) {
    await sendPreviewOnce(incidents, tiktokRows.length, clientesSeen.size).catch((error) =>
      console.warn("[prepago-guard] preview failed", error),
    );
  }

  if (record) await createAdminClient().from("audit_logs").insert({
    action: AUDIT_ACTION,
    entity_type: "prepago_guard",
    metadata: {
      mode,
      scanned_advertisers: tiktokRows.length,
      ads_clientes: clientesSeen.size,
      incidents_count: incidents.length,
      incidents_hash: incidentsHash(incidents.filter((i) => !isResolved(i))),
      corrected_count: incidents.filter(isResolved).length,
      alerted,
      alert_reason: reason,
      incidents: incidents.slice(0, 200),
    },
  });

  return {
    mode,
    scannedAdvertisers: tiktokRows.length,
    adsClientes: clientesSeen.size,
    incidents,
    alerted,
    alertReason: reason,
  };
}

/** Saldo asignado actual del advertiser: suma de todas sus filas (mismo criterio que la detección). */
async function readLiveLedgerUsd(adAccountIds: string[]): Promise<number> {
  if (adAccountIds.length === 0) return 0;
  const { data, error } = await createAdminClient()
    .from("v_ad_account_ledger_balances")
    .select("available_balance_cents")
    .in("ad_account_id", adAccountIds);
  if (error) throw new Error(`Saldo asignado: ${error.message}`);
  return (data ?? []).reduce(
    (sum, row) => sum + Math.max(0, (Number(row.available_balance_cents) || 0) / 100),
    0,
  );
}

/**
 * Baja el presupuesto de las cuentas con gasto por encima de lo asignado.
 * Solo en modo enforce y con `apply` (las pruebas locales no escriben).
 */
async function correctIncidents(
  incidents: PrepagoGuardIncident[],
  mode: PrepagoGuardMode,
  apply: boolean,
): Promise<void> {
  const budget = incidents.filter((i) => i.kind !== "credit_without_approval");
  if (budget.length === 0) return;

  const toCorrect = budget.filter((i) => apply && mayCorrect(i, mode));
  for (const i of budget) if (!toCorrect.includes(i)) i.correction = { status: "skipped_alert_mode" };
  if (toCorrect.length === 0) return;

  if (toCorrect.length > MAX_CORRECTIONS_PER_RUN) {
    for (const i of toCorrect) i.correction = { status: "skipped_circuit_breaker" };
    console.warn("[prepago-guard] circuit_breaker", { accounts: toCorrect.length });
    return;
  }

  for (const i of toCorrect) {
    if (i.kind === "direct_recharge") {
      await refundDirectRecharge(i);
      continue;
    }
    if (!i.bcId || !i.advertiserId || i.targetBudgetUsd == null) {
      i.correction = { status: "failed", error: "Faltan datos de la cuenta en TikTok." };
      continue;
    }
    try {
      // Entre la lectura masiva y este momento el cliente pudo asignar saldo o
      // alguien pudo bajar el presupuesto: se releen saldo y TikTok en vivo.
      const live = await getAdvertiserBudgetSnapshot({
        bcId: i.bcId,
        advertiserId: i.advertiserId,
        organizationId: i.organizationId,
      });
      if (!live) {
        i.correction = { status: "failed", error: "No se pudo releer la cuenta en TikTok." };
        continue;
      }
      const ledgerUsd = await readLiveLedgerUsd(i.adAccountIds ?? []);
      const liveUnlimited = live.budgetMode === "UNLIMITED";
      const liveRemaining = round2(live.budget - live.budgetCost);
      const target = round2(live.budgetCost + ledgerUsd);
      if (!liveUnlimited && (liveRemaining - ledgerUsd <= TOLERANCE_USD || target >= live.budget)) {
        // Ya está en orden, o corregir implicaría subir: nunca se sube.
        i.correction = { status: "not_needed" };
        continue;
      }
      i.ledgerUsd = round2(ledgerUsd);
      i.targetBudgetUsd = target;
      i.costUsd = round2(live.budgetCost);

      const result = await setSharedBmAdvertiserBudgetAbsolute({
        bcId: i.bcId,
        advertiserId: i.advertiserId,
        budgetUsd: target,
        organizationId: i.organizationId,
        preferBudgetMode: "CUSTOM_BUDGET",
      });
      i.correction = {
        status: "corrected",
        previousBudgetUsd: result.previousBudget,
        newBudgetUsd: result.newBudget,
      };
      console.info("[prepago-guard] corrected", {
        advertiserId: i.advertiserId,
        previousBudget: result.previousBudget,
        newBudget: result.newBudget,
        skipped: result.skipped,
      });
    } catch (error) {
      i.correction = {
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 200) : "Error de TikTok",
      };
      console.error("[prepago-guard] correction_failed", { advertiserId: i.advertiserId, error });
    }
  }
}

/** Antes del arranque general solo se corrige a los de ENFORCED_EARLY. */
function mayCorrect(i: PrepagoGuardIncident, mode: PrepagoGuardMode): boolean {
  if (i.enforcedEarly) return true;
  if (mode !== "enforce") return false;
  // Una recarga directa hecha durante el periodo de solo aviso no se devuelve después.
  if (i.kind === "direct_recharge") return Date.parse(i.rechargedAt ?? "") >= RULE_ENFORCE_FROM;
  return true;
}

type BcTransaction = {
  id: string;
  bm: string;
  advertiserId: string;
  name: string;
  type: string;
  billing: string;
  amountUsd: number;
  at: number;
};

/** create_time viene en la zona del BC ("2026-10-27 13:31:15", timezone "UTC-05:00"). */
function parseTikTokTime(time: string, zone: string): number {
  const offset = /UTC([+-]\d{2}:\d{2})/.exec(zone)?.[1] ?? "-05:00";
  return Date.parse(`${time.replace(" ", "T")}${offset}`);
}

/** Lima no tiene horario de verano: UTC-5 fijo, igual que los BC. */
function limaTime(ms: number): string {
  return new Date(ms - 5 * 3_600_000).toISOString().slice(0, 19).replace("T", " ");
}

async function listBcTransactions(bm: string, bcId: string, fromMs: number, token: string): Promise<BcTransaction[]> {
  const out: BcTransaction[] = [];
  const filtering = JSON.stringify({ start_time: limaTime(fromMs), end_time: limaTime(Date.now() + 3_600_000) });
  for (let page = 1; page <= 20; page++) {
    const qs = new URLSearchParams({ bc_id: bcId, transaction_level: "ADVERTISER", filtering, page: String(page), page_size: "50" });
    const res = await fetch(`${TIKTOK_API}/bc/account/transaction/get/?${qs}`, { headers: { "Access-Token": token }, cache: "no-store" });
    const json = (await res.json()) as {
      code?: number;
      message?: string;
      data?: { transaction_list?: Array<Record<string, unknown>>; page_info?: { total_number?: number } };
    };
    if (json.code !== 0) throw new Error(`BM${bm} transacciones: ${json.message ?? "TikTok error"}`);
    for (const t of json.data?.transaction_list ?? []) {
      // TikTok devuelve también las de otros BC del mismo token: sin esto cada recarga sale dos veces.
      if (String(t.bc_id ?? "") !== bcId) continue;
      out.push({
        id: String(t.transaction_id ?? ""),
        bm,
        advertiserId: String(t.account_id ?? ""),
        name: String(t.account_name ?? ""),
        type: String(t.transaction_type ?? ""),
        billing: String(t.billing_type ?? ""),
        amountUsd: Number(t.amount) || 0,
        at: parseTikTokTime(String(t.create_time ?? ""), String(t.timezone ?? "")),
      });
    }
    if (page * 50 >= (json.data?.page_info?.total_number ?? 0)) break;
  }
  return out;
}

/** Transacciones ya devueltas en corridas anteriores (para no devolverlas dos veces). */
async function loadRefundedTransactionIds(sinceMs: number): Promise<Set<string>> {
  const { data } = await createAdminClient()
    .from("audit_logs")
    .select("metadata")
    .eq("action", AUDIT_ACTION)
    .gte("created_at", new Date(sinceMs).toISOString())
    .order("created_at", { ascending: false })
    .limit(60);
  const ids = new Set<string>();
  for (const run of data ?? []) {
    const list = ((run.metadata ?? {}) as { incidents?: PrepagoGuardIncident[] }).incidents ?? [];
    for (const i of list) {
      if (i.kind === "direct_recharge" && i.transactionId && i.correction?.status === "corrected") ids.add(i.transactionId);
    }
  }
  return ids;
}

/**
 * Recargas cash (BM200/300) de los últimos RECHARGE_LOOKBACK_MS que no salieron de
 * Ads Holistic. Se descartan:
 * - las que calzan con una asignación de Ads (misma cuenta y monto, a minutos);
 * - las que son un traspaso entre cuentas del mismo cliente (sale lo mismo de otra);
 * - montos chicos y las ya devueltas.
 */
async function findDirectRecharges(
  byAdvertiser: Map<string, { ledgerUsd: number; hecomId: string; clienteName: string; organizationId: string; adAccountIds: string[] }>,
  token: string,
): Promise<PrepagoGuardIncident[]> {
  const fromMs = Math.max(DIRECT_RECHARGE_SINCE, Date.now() - RECHARGE_LOOKBACK_MS);
  const txs: BcTransaction[] = [];
  for (const bm of CASH_BUCKETS) {
    const bcId = HECOM_BM_BUCKET_TO_BC[bm];
    if (bcId) txs.push(...(await listBcTransactions(bm, bcId, fromMs, token)));
  }
  const increases = txs.filter(
    (t) => t.type === "INCREASE_BALANCE" && t.billing === "CASH" && t.at >= fromMs && byAdvertiser.has(t.advertiserId),
  );
  if (increases.length === 0) return [];

  const { data: allocations, error } = await createAdminClient()
    .from("ledger_journals")
    .select("created_at, adv:metadata->>tiktok_advertiser_id, cents:metadata->>tiktok_amount_cents")
    .eq("journal_type", "allocation_to_ad_account")
    .gte("created_at", new Date(fromMs - MATCH_WINDOW_MS).toISOString())
    .in("metadata->>tiktok_advertiser_id", [...new Set(increases.map((t) => t.advertiserId))]);
  if (error) throw new Error(`Asignaciones: ${error.message}`);
  const unusedAllocations = (allocations ?? []).map((a) => ({
    adv: String(a.adv ?? ""),
    cents: Number(a.cents) || 0,
    at: Date.parse(String(a.created_at)),
  }));
  const decreases = txs.filter((t) => t.type === "DECREASE_BALANCE" && t.billing === "CASH");
  const refunded = await loadRefundedTransactionIds(fromMs - 3_600_000);

  const out: PrepagoGuardIncident[] = [];
  for (const t of increases.sort((a, b) => a.at - b.at)) {
    const cents = Math.round(t.amountUsd * 100);
    const near = (at: number) => Math.abs(at - t.at) <= MATCH_WINDOW_MS;
    const alloc = unusedAllocations.findIndex((a) => a.adv === t.advertiserId && Math.abs(a.cents - cents) <= 1 && near(a.at));
    if (alloc >= 0) {
      unusedAllocations.splice(alloc, 1);
      continue;
    }
    const holistic = byAdvertiser.get(t.advertiserId)!;
    const move = decreases.findIndex(
      (d) =>
        d.advertiserId !== t.advertiserId &&
        byAdvertiser.get(d.advertiserId)?.hecomId === holistic.hecomId &&
        Math.abs(Math.round(d.amountUsd * 100) - cents) <= 1 &&
        near(d.at),
    );
    if (move >= 0) {
      decreases.splice(move, 1);
      continue;
    }
    if (t.amountUsd < MIN_DIRECT_RECHARGE_USD || refunded.has(t.id)) continue;
    out.push({
      kind: "direct_recharge",
      hecomClienteId: holistic.hecomId,
      clienteName: holistic.clienteName,
      advertiserId: t.advertiserId,
      advertiserName: t.name,
      bm: t.bm,
      transactionId: t.id,
      rechargedAt: new Date(t.at).toISOString(),
      rechargeUsd: round2(t.amountUsd),
      ledgerUsd: holistic.ledgerUsd,
      excessUsd: round2(t.amountUsd),
      bcId: HECOM_BM_BUCKET_TO_BC[t.bm],
      organizationId: holistic.organizationId,
      adAccountIds: holistic.adAccountIds,
      enforcedEarly: ENFORCED_EARLY.has(holistic.hecomId.toLowerCase()),
    });
  }
  return out;
}

/**
 * Devuelve al BM una recarga directa. Relee TikTok y la cartera en vivo: nunca
 * toca lo que respalda su saldo asignado (plata que sí pagó) ni más de lo recargado.
 */
async function refundDirectRecharge(i: PrepagoGuardIncident): Promise<void> {
  try {
    const live = await readLive(i.bm!, i.advertiserId!);
    const ledgerUsd = round2(await readLiveLedgerUsd(i.adAccountIds ?? []));
    const refundable = Math.floor(Math.min(i.rechargeUsd ?? 0, live.cash - ledgerUsd) * 100) / 100;
    i.tiktokRemainingUsd = round2(live.cash);
    i.ledgerUsd = ledgerUsd;
    i.excessUsd = Math.max(0, refundable);
    if (refundable <= TOLERANCE_USD) {
      i.correction = { status: "failed", error: "Ya lo gastó: no queda saldo para devolver." };
      return;
    }
    const r = await bajarSaldoCuenta({ bm: i.bm!, advertiserId: i.advertiserId!, amountUsd: refundable });
    i.correction = {
      status: r.removedUsd > 0 ? "corrected" : "failed",
      refundedUsd: r.removedUsd,
      error: r.removedUsd > 0 ? undefined : r.message,
    };
    console.info("[prepago-guard] direct_recharge_refunded", { advertiserId: i.advertiserId, refunded: r.removedUsd });
  } catch (error) {
    i.correction = {
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 200) : "Error de TikTok",
    };
    console.error("[prepago-guard] direct_recharge_refund_failed", { advertiserId: i.advertiserId, error });
  }
}

/** Primer correo en producción, a quien pidió probar el guardián. Una sola vez. */
async function sendPreviewOnce(
  incidents: PrepagoGuardIncident[],
  scanned: number,
  clientes: number,
): Promise<void> {
  const admin = createAdminClient();
  const { data: done } = await admin
    .from("audit_logs")
    .select("id")
    .eq("action", PREVIEW_ACTION)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (done?.id) return;

  const email = buildGuardEmail(incidents, { preview: true, scanned, clientes });
  for (const to of PREVIEW_TO) {
    await sendTransactionalEmail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      templateKey: "ops.prepago_guard.preview",
      idempotencyKey: `email:prepago_guard_preview:${to}`,
      metadata: { incidents_count: incidents.length },
    });
  }
  await admin.from("audit_logs").insert({
    action: PREVIEW_ACTION,
    entity_type: "prepago_guard",
    metadata: { to: PREVIEW_TO, incidents_count: incidents.length, scanned_advertisers: scanned },
  });
}

/** Huella de lo que sigue sin corregirse: cambia si aparece otra cuenta o el exceso sube de a $10. */
function incidentsHash(incidents: PrepagoGuardIncident[]): string {
  const key = incidents
    .map((i) => `${i.kind}:${i.transactionId ?? i.advertiserId ?? i.hecomClienteId}:${i.unlimited ? "U" : Math.floor((i.excessUsd ?? 0) / 10)}`)
    .sort()
    .join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function isResolved(incident: PrepagoGuardIncident): boolean {
  return incident.correction?.status === "corrected";
}

/**
 * Cuándo avisar:
 * - Si en esta revisión se corrigió algo: siempre, en el momento.
 * - Si queda algo sin corregir: al aparecer y luego cada hora mientras siga.
 */
async function alertIfNeeded(
  incidents: PrepagoGuardIncident[],
  mode: PrepagoGuardMode,
): Promise<{ alerted: boolean; reason: string }> {
  if (incidents.length === 0) return { alerted: false, reason: "sin_incidentes" };

  const correctedNow = incidents.filter(isResolved);
  const pending = incidents.filter((i) => !isResolved(i));
  const hash = incidentsHash(pending);

  if (correctedNow.length === 0) {
    // audit_logs tiene cientos de miles de filas: solo la ventana de re-aviso,
    // y el filtro por metadata se hace aquí para no depender de un índice.
    const since = new Date(Date.now() - REALERT_AFTER_HOURS * 3_600_000).toISOString();
    const { data: recentRuns } = await createAdminClient()
      .from("audit_logs")
      .select("created_at, metadata")
      .eq("action", AUDIT_ACTION)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);
    const alreadyAlerted = (recentRuns ?? []).some((run) => {
      const meta = (run.metadata ?? {}) as { alerted?: boolean; incidents_hash?: string };
      return meta.alerted === true && meta.incidents_hash === hash;
    });
    if (alreadyAlerted) return { alerted: false, reason: "ya_avisado" };
  }

  const managers = resolveManualPaymentManagerEmails();
  if (managers.length === 0) return { alerted: false, reason: "sin_destinatarios" };

  const email = buildGuardEmail(incidents, undefined, mode);
  const stamp = new Date().toISOString().slice(0, 16);
  let sent = 0;
  for (let i = 0; i < managers.length; i += MANAGER_EMAILS_PER_SECOND) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
    const batch = await Promise.allSettled(
      managers.slice(i, i + MANAGER_EMAILS_PER_SECOND).map((to) =>
        sendTransactionalEmail({
          to,
          subject: email.subject,
          html: email.html,
          text: email.text,
          templateKey: "ops.prepago_guard.alert",
          idempotencyKey: `email:prepago_guard:${hash}:${stamp}:${to}`,
          metadata: { incidents_hash: hash, incidents_count: incidents.length, corrected: correctedNow.length },
        }),
      ),
    );
    sent += batch.filter((r) => r.status === "fulfilled").length;
  }
  if (sent === 0) return { alerted: false, reason: "envio_fallido" };
  return { alerted: true, reason: correctedNow.length ? "corregido" : "pendiente" };
}

function usd(value: number | undefined): string {
  return value == null ? "—" : `USD ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function actionLabel(i: PrepagoGuardIncident): { text: string; color: string } {
  switch (i.correction?.status) {
    case "corrected": {
      if (i.kind === "direct_recharge") {
        return { text: `Devuelto al BM ${usd(i.correction.refundedUsd)}`, color: "#1f6b3a" };
      }
      const after =
        i.correction.newBudgetUsd != null && i.costUsd != null
          ? Math.max(0, round2(i.correction.newBudgetUsd - i.costUsd))
          : i.ledgerUsd;
      return { text: `Ahora puede gastar ${usd(after)}`, color: "#1f6b3a" };
    }
    case "failed":
      return { text: i.kind === "direct_recharge" && i.correction.error ? i.correction.error : "No se pudo corregir", color: "#8f1d12" };
    case "skipped_circuit_breaker":
      return { text: "Sin corregir (freno)", color: "#8f1d12" };
    default:
      if (i.kind === "direct_recharge") return { text: `Se devolvería al BM (hasta ${usd(i.rechargeUsd)})`, color: "#57524b" };
      return { text: `Debería poder gastar ${usd(i.ledgerUsd)}`, color: "#57524b" };
  }
}

function buildGuardEmail(
  incidents: PrepagoGuardIncident[],
  preview?: { preview: true; scanned: number; clientes: number },
  mode: PrepagoGuardMode = "enforce",
) {
  const budget = incidents.filter((i) => i.kind !== "credit_without_approval");
  const credit = incidents.filter((i) => i.kind === "credit_without_approval");
  const corrected = budget.filter(isResolved);
  const pending = budget.filter((i) => !isResolved(i));
  const breaker = budget.some((i) => i.correction?.status === "skipped_circuit_breaker");
  const clientes = new Set(incidents.map((i) => i.hecomClienteId)).size;
  const allClear = incidents.length === 0;
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  const headline = allClear
    ? "Todo en orden"
    : pending.length === 0 && credit.length === 0
      ? `Se ${plural(corrected.length, "corrigió 1 cuenta", `corrigieron ${corrected.length} cuentas`)} que podía${plural(corrected.length, "", "n")} gastar más que su saldo`
      : `${corrected.length ? `Se ${plural(corrected.length, "corrigió 1 cuenta", `corrigieron ${corrected.length} cuentas`)} · ` : ""}${pending.length} cuenta${plural(pending.length, " sigue", "s siguen")} pudiendo gastar más que su saldo`;

  const subject = `${preview ? "[Prueba] Guardián de prepago activo · " : pending.length || credit.length ? "[Acción] Prepago: " : "[Corregido] Prepago: "}${
    allClear ? "todo en orden" : `${headline.charAt(0).toLowerCase()}${headline.slice(1)} · ${clientes} cliente${plural(clientes, "", "s")}`
  }`;

  const explanation =
    mode === "alert" && corrected.length === 0
      ? "Está en <b>modo solo aviso</b>: no cambió nada. Para corregir, ajusta el presupuesto en TikTok al valor sugerido o asigna saldo desde la cartera."
      : breaker
        ? `Aparecieron más de ${MAX_CORRECTIONS_PER_RUN} cuentas a la vez, así que <b>no se corrigió ninguna</b> por seguridad: puede ser una falla al leer los saldos. Revisen antes de ajustar.`
        : pending.length
          ? "Lo que no se pudo corregir sigue pudiendo gastar de más. Revísenlo en TikTok."
          : budget.some((i) => i.kind === "direct_recharge")
            ? "Alguien le puso saldo en TikTok directo desde el BC, sin pasar por su cartera, a un cliente que solo puede gastar lo que asigna desde el sistema. Ese saldo se devolvió al BM. TikTok no registra quién lo puso: revisen quién tiene permiso de Finanzas en el BC."
            : "El presupuesto en TikTok se bajó a lo ya gastado más el saldo asignado desde la cartera. Si el cliente necesita más, debe asignar saldo desde su cartera.";

  const rowsHtml = budget
    .map((i) => {
      const action = actionLabel(i);
      return `
        <tr>
          <td style="padding:10px 12px 10px 0;border-top:1px solid #e8e4dd;font-size:14px;color:#1a1917;vertical-align:top;">${escapeHtml(i.clienteName)}<br /><span style="font-size:12px;color:#57524b;">${escapeHtml(i.advertiserName ?? "")} · BM${escapeHtml(i.bm ?? "")}${i.kind === "direct_recharge" ? ` · recarga directa ${escapeHtml(limaTime(Date.parse(i.rechargedAt ?? "")).slice(0, 16))}` : ""}</span></td>
          <td align="right" style="padding:10px 0;border-top:1px solid #e8e4dd;font-size:14px;color:#1a1917;vertical-align:top;white-space:nowrap;">${i.kind === "direct_recharge" ? usd(i.rechargeUsd) : i.unlimited ? "Ilimitado" : usd(i.tiktokRemainingUsd)}</td>
          <td align="right" style="padding:10px 0 10px 12px;border-top:1px solid #e8e4dd;font-size:14px;color:#1a1917;vertical-align:top;white-space:nowrap;">${usd(i.ledgerUsd)}</td>
          <td align="right" style="padding:10px 0 10px 12px;border-top:1px solid #e8e4dd;font-size:14px;font-weight:700;color:${action.color};vertical-align:top;white-space:nowrap;">${escapeHtml(action.text)}</td>
        </tr>`;
    })
    .join("");

  const creditHtml = credit.length
    ? `<p style="margin:0 0 16px;padding:14px 18px;background:#fbeeec;border-radius:6px;font-size:15px;line-height:1.5;color:#8f1d12;">
         El sistema trata como crédito, sin aprobación de gerencia, a: <b>${credit.map((c) => escapeHtml(c.clienteName)).join(", ")}</b>. En Ads todos deben ser prepago.
       </p>`
    : "";

  const previewHtml = preview
    ? `<p style="margin:0 0 20px;padding:14px 18px;background:#f6f1e8;border-radius:6px;font-size:14px;line-height:1.5;color:#4a463f;">
         Correo de prueba: el guardián ya corre en producción cada 15 minutos. En esta revisión leyó <b>${preview.scanned}</b> cuentas de BM10 y BM30 y <b>${preview.clientes}</b> clientes de Ads.
       </p>`
    : "";

  const bodyHtml = allClear
    ? `${previewHtml}
      <p style="margin:0;font-size:24px;line-height:1.25;font-weight:700;color:#1a1917;">Todo en orden</p>
      <p style="margin:10px 0 0;font-size:15px;line-height:1.5;color:#57524b;">Ninguna cuenta de TikTok de clientes de Ads puede gastar más que su saldo asignado, y ningún cliente está como crédito sin aprobación.</p>`
    : `${previewHtml}
      <p style="margin:0;font-size:24px;line-height:1.25;font-weight:700;color:#1a1917;">${escapeHtml(headline)}</p>
      <p style="margin:10px 0 24px;font-size:15px;line-height:1.5;color:#57524b;">${explanation}</p>
      ${creditHtml}
      ${
        budget.length
          ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding:0 12px 8px 0;font-size:12px;color:#57524b;">Cliente / cuenta</td>
          <td align="right" style="padding:0 0 8px;font-size:12px;color:#57524b;">Podía gastar en TikTok</td>
          <td align="right" style="padding:0 0 8px 12px;font-size:12px;color:#57524b;">Saldo asignado</td>
          <td align="right" style="padding:0 0 8px 12px;font-size:12px;color:#57524b;">Qué se hizo</td>
        </tr>
        ${rowsHtml}
      </table>`
          : ""
      }`;

  const html = wrapInternalEmail({
    label: "Guardián de prepago",
    preview: subject,
    bodyHtml,
    footerNote: `Holistic Marketing · aviso interno para gerencia · revisión automática cada 15 minutos`,
  });

  const text = [
    subject,
    explanation.replace(/<[^>]+>/g, ""),
    ...credit.map((c) => `CRÉDITO SIN APROBACIÓN: ${c.clienteName}`),
    ...budget.map(
      (i) =>
        `${i.clienteName} · ${i.advertiserName} · BM${i.bm}: podía gastar ${i.unlimited ? "ilimitado" : usd(i.tiktokRemainingUsd)}, saldo asignado ${usd(i.ledgerUsd)}. ${actionLabel(i).text}.`,
    ),
  ].join("\n");

  return { subject, html, text };
}

/** Solo para vistas previas y pruebas locales del correo. */
export const buildGuardEmailForPreview = buildGuardEmail;
