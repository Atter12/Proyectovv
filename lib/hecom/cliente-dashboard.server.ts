import "server-only";
import { cache } from "react";
import {
  filterBackupByClient,
  loadHecomBackupJson,
} from "@/lib/hecom/backup-data.server";
import {
  getHecomCliente,
  isOtpTestClienteId,
  type HecomCliente,
  type HecomTiktokAccount,
} from "@/lib/hecom/clientes.server";
import { getAdvertiserIdFromCamp } from "@/lib/hecom/gasto-label";
import {
  createHecomAdminClient,
  getHecomSupabaseConfig,
} from "@/lib/hecom/supabase.server";
import { resolveFeePercentFromHecomCliente } from "@/lib/payments/resolve-hecom-deposit-fee.server";

export type HecomGastoRow = {
  id: string;
  camp: string | null;
  gasto: number;
  fee: number | null;
  mes: string | null;
  source: string | null;
  fecha: string | null;
  codigo: string | null;
  notas: string | null;
};

export type HecomCobroRow = {
  id: string;
  monto: number;
  fecha: string | null;
  metodo: string | null;
  notas: string | null;
  codigo: string | null;
};

export type HecomCreativoCliente = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
};

export type HecomCreativoProyecto = {
  id: string;
  name: string;
  type: string | null;
  platform: string | null;
  format: string | null;
  published: boolean | null;
};

/** One calendar day of ad spend (USD). */
export type HecomDailySpendPoint = {
  date: string;
  spend: number;
};

export type HecomDailySpendSource = "snapshots" | "gastos" | "none";

export type HecomClienteDashboard = {
  source: "hecom_live" | "hecom_backup";
  cliente: HecomCliente;
  accounts: HecomTiktokAccount[];
  gastos: HecomGastoRow[];
  cobros: HecomCobroRow[];
  creativosClientes: HecomCreativoCliente[];
  creativosProyectos: HecomCreativoProyecto[];
  summary: {
    accountCount: number;
    gastoTotal: number;
    feeTotal: number;
    cargoTotal: number;
    cobroTotal: number;
    /** cobros − (gastos + fees). Negativo = deuda neta (como Hecom Club). */
    saldoEstimado: number;
    creativeCount: number;
    projectCount: number;
    /** Gasto ads del día (tz America/Lima). */
    gastoHoy: number;
    gasto7d: number;
    gasto30d: number;
    /** Serie diaria rellena (incluye 0), del más viejo al más nuevo. */
    dailySeries: HecomDailySpendPoint[];
    dailySource: HecomDailySpendSource;
    /** Fecha ancla YYYY-MM-DD (hoy Lima o último día con gasto). */
    dailyAnchorDate: string;
    /**
     * % Holistic del cliente (Hecom: tiktok_default_fee / fee de cuenta).
     * Usado en depósitos: neto = bruto / (1 + fee/100).
     */
    depositFeePercent: number;
    depositFeeSource: "hecom_cliente" | "hecom_account" | "default";
  };
};

const DAILY_SPEND_TZ = "America/Lima";
const DAILY_SERIES_DAYS = 14;

function resolveAccounts(cliente: HecomCliente): HecomTiktokAccount[] {
  if (cliente.tiktokAccounts.length > 0) return cliente.tiktokAccounts;
  if (cliente.tiktokAdvertiserId) {
    return [
      {
        advertiserId: cliente.tiktokAdvertiserId,
        advertiserName: cliente.tiktokAdvertiserName,
        bmBucket: null,
        fee: cliente.tiktokDefaultFee,
        syncEnabled: cliente.tiktokSyncEnabled !== false,
      },
    ];
  }
  return [];
}

function mapGasto(row: Record<string, unknown>): HecomGastoRow {
  const fecha =
    dateKeyFromUnknown(row.tiktok_stat_date) ??
    dateKeyFromUnknown(row.fecha_movimiento) ??
    dateKeyFromUnknown(row.mes) ??
    (row.tiktok_stat_date
      ? String(row.tiktok_stat_date)
      : row.fecha_movimiento
        ? String(row.fecha_movimiento)
        : row.mes
          ? String(row.mes)
          : null);

  return {
    id: String(row.id ?? ""),
    camp: row.camp ? String(row.camp) : null,
    gasto: Number(row.gasto ?? row.monto ?? 0) || 0,
    fee: row.fee != null && Number.isFinite(Number(row.fee)) ? Number(row.fee) : null,
    mes: row.mes ? String(row.mes) : null,
    source: row.source ? String(row.source) : null,
    fecha,
    codigo: row.codigo ? String(row.codigo) : null,
    notas: row.notas ? String(row.notas) : null,
  };
}

function mapCobro(row: Record<string, unknown>): HecomCobroRow {
  return {
    id: String(row.id ?? ""),
    monto: Number(row.monto ?? 0) || 0,
    fecha: row.fecha ? String(row.fecha) : null,
    metodo: row.metodo ? String(row.metodo) : null,
    notas: row.notas ? String(row.notas) : null,
    codigo: row.codigo ? String(row.codigo) : null,
  };
}

function mapCreativoCliente(row: Record<string, unknown>): HecomCreativoCliente {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Creativo"),
    company: row.company ? String(row.company) : null,
    email: row.email ? String(row.email) : null,
  };
}

function mapCreativoProyecto(row: Record<string, unknown>): HecomCreativoProyecto {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Proyecto"),
    type: row.type ? String(row.type) : null,
    platform: row.platform ? String(row.platform) : null,
    format: row.format ? String(row.format) : null,
    published:
      typeof row.published === "boolean"
        ? row.published
        : row.published != null
          ? Boolean(row.published)
          : null,
  };
}

function feeAmountForGasto(row: HecomGastoRow, fallbackFeePct: number | null): number {
  const pct =
    row.fee != null && Number.isFinite(row.fee)
      ? row.fee
      : fallbackFeePct != null && Number.isFinite(fallbackFeePct)
        ? fallbackFeePct
        : 0;
  if (pct <= 0 || row.gasto <= 0) return 0;
  return Math.round(row.gasto * (pct / 100) * 100) / 100;
}

function calendarDateInTz(
  date: Date = new Date(),
  timeZone: string = DAILY_SPEND_TZ,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftCalendarDate(dateYmd: string, deltaDays: number): string {
  const base = new Date(`${dateYmd}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

/**
 * Normaliza fechas Hecom → YYYY-MM-DD.
 * Soporta ISO, timestamps y DD/MM/YYYY (formato frecuente en CRM / UI).
 */
function dateKeyFromUnknown(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // 2026-07-29 or 2026-07-29T15:00:00...
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;

  // 29/07/2026 or 29-07-2026
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const yyyy = dmy[3];
    const candidate = `${yyyy}-${mm}-${dd}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  }

  // 07/29/2026 (US) — solo si el primer grupo > 12 (ambiguo se trata como DMY arriba)
  const mdy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (mdy && Number(mdy[1]) > 12) {
    // already handled as DMY
  }

  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) {
    return calendarDateInTz(new Date(parsed));
  }

  return null;
}

function sumSpendOnAndAfter(
  byDate: Map<string, number>,
  startDate: string,
  endDate?: string,
): number {
  let total = 0;
  for (const [date, spend] of byDate) {
    if (date < startDate) continue;
    if (endDate && date > endDate) continue;
    total += spend;
  }
  return Math.round(total * 100) / 100;
}

function fillDailySeries(
  byDate: Map<string, number>,
  endDate: string,
  days: number,
): HecomDailySpendPoint[] {
  const startDate = shiftCalendarDate(endDate, -(days - 1));
  const series: HecomDailySpendPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = shiftCalendarDate(startDate, i);
    series.push({
      date,
      spend: Math.round((byDate.get(date) ?? 0) * 100) / 100,
    });
  }
  return series;
}

function spendMapFromGastos(gastos: HecomGastoRow[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const row of gastos) {
    const key = dateKeyFromUnknown(row.fecha);
    if (!key) continue;
    const spend = Number(row.gasto);
    if (!Number.isFinite(spend) || spend <= 0) continue;
    byDate.set(key, (byDate.get(key) ?? 0) + spend);
  }
  return byDate;
}

/**
 * Une gasto Hecom + snapshots TikTok.
 * - Gastos rellenan el mapa (CRM / historial visible).
 * - Snapshots pisan el mismo día (fuente TikTok del día).
 * Así no se pierden días reales del listado cuando los snapshots están viejos.
 */
function mergeDailySpendMaps(
  fromGastos: Map<string, number>,
  fromSnapshots: Map<string, number> | null,
): { byDate: Map<string, number>; source: HecomDailySpendSource } {
  const byDate = new Map<string, number>();
  for (const [date, spend] of fromGastos) {
    byDate.set(date, spend);
  }

  let usedSnapshots = false;
  if (fromSnapshots && fromSnapshots.size > 0) {
    for (const [date, spend] of fromSnapshots) {
      if (!Number.isFinite(spend) || spend < 0) continue;
      const existing = byDate.get(date) ?? 0;
      // Snapshot gana si trae gasto real; no pisar un día Hecom > 0 con un 0 vacío.
      if (spend > 0 || existing <= 0) {
        byDate.set(date, spend);
      }
      if (spend > 0) usedSnapshots = true;
    }
  }

  if (byDate.size === 0) return { byDate, source: "none" };
  if (usedSnapshots) return { byDate, source: "snapshots" };
  if (fromGastos.size > 0) return { byDate, source: "gastos" };
  return { byDate, source: fromSnapshots && fromSnapshots.size > 0 ? "snapshots" : "none" };
}

function spendMapFromSnapshotRows(
  rows: Array<Record<string, unknown>>,
): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    const key = dateKeyFromUnknown(row.stat_date);
    if (!key) continue;
    const spend = Number(row.spend ?? 0);
    if (!Number.isFinite(spend) || spend < 0) continue;
    byDate.set(key, (byDate.get(key) ?? 0) + spend);
  }
  return byDate;
}

async function loadSnapshotSpendMap(
  clientId: string,
  startDate: string,
): Promise<Map<string, number> | null> {
  try {
    const hecom = createHecomAdminClient();
    const { data, error } = await hecom
      .from("tiktok_spend_snapshots")
      .select("stat_date,spend,client_id")
      .eq("client_id", clientId)
      .gte("stat_date", startDate)
      .order("stat_date", { ascending: false })
      .limit(5000);

    if (error) return null;
    return spendMapFromSnapshotRows(
      (data ?? []) as Array<Record<string, unknown>>,
    );
  } catch {
    return null;
  }
}

function buildDailySpendSummary(
  byDate: Map<string, number>,
  source: HecomDailySpendSource,
) {
  const today = calendarDateInTz();
  const positiveDates = [...byDate.entries()]
    .filter(([, spend]) => spend > 0)
    .map(([date]) => date)
    .sort();
  const lastSpendDate = positiveDates.at(-1) ?? null;

  // Hoy calendario (America/Lima)
  let gastoHoy = Math.round((byDate.get(today) ?? 0) * 100) / 100;
  let gasto7d = sumSpendOnAndAfter(byDate, shiftCalendarDate(today, -6), today);
  let gasto30d = sumSpendOnAndAfter(
    byDate,
    shiftCalendarDate(today, -29),
    today,
  );
  let seriesEnd = today;

  /**
   * Si el calendario de hoy/7d está vacío pero el CRM tiene gasto reciente
   * (p.ej. listado con 27–29/07 y hoy 08/08), anclar a la última fecha con gasto
   * para que los KPIs coincidan con lo que el usuario ve en el historial.
   * Gracia: hasta 21 días atrás.
   */
  if (
    lastSpendDate &&
    gasto7d <= 0 &&
    lastSpendDate >= shiftCalendarDate(today, -21)
  ) {
    seriesEnd = lastSpendDate;
    gasto7d = sumSpendOnAndAfter(
      byDate,
      shiftCalendarDate(lastSpendDate, -6),
      lastSpendDate,
    );
    gasto30d = sumSpendOnAndAfter(
      byDate,
      shiftCalendarDate(lastSpendDate, -29),
      lastSpendDate,
    );
    if (gastoHoy <= 0) {
      gastoHoy = Math.round((byDate.get(lastSpendDate) ?? 0) * 100) / 100;
    }
  }

  return {
    gastoHoy,
    gasto7d,
    gasto30d,
    dailySeries: fillDailySeries(byDate, seriesEnd, DAILY_SERIES_DAYS),
    dailySource: source,
    /** Fecha ancla usada para hoy/7d (hoy Lima o último día con gasto). */
    dailyAnchorDate: seriesEnd,
  };
}

function emptyDailySpendSummary() {
  return buildDailySpendSummary(new Map(), "none");
}

function buildSummary(
  cliente: HecomCliente,
  accounts: HecomTiktokAccount[],
  gastos: HecomGastoRow[],
  cobros: HecomCobroRow[],
  creativosClientes: HecomCreativoCliente[],
  creativosProyectos: HecomCreativoProyecto[],
  daily?: ReturnType<typeof buildDailySpendSummary>,
) {
  const feeResolved = resolveFeePercentFromHecomCliente({
    tiktokDefaultFee: cliente.tiktokDefaultFee,
    accountFees: accounts.map((a) => a.fee),
  });
  const fallbackFeePct = feeResolved.feePercent;
  const gastoTotal = gastos.reduce((sum, row) => sum + row.gasto, 0);
  const feeTotal = gastos.reduce(
    (sum, row) => sum + feeAmountForGasto(row, fallbackFeePct),
    0,
  );
  const cargoTotal = Math.round((gastoTotal + feeTotal) * 100) / 100;
  const cobroTotal = cobros.reduce((sum, row) => sum + row.monto, 0);
  const dailySummary = daily ?? emptyDailySpendSummary();
  return {
    accountCount: accounts.length,
    gastoTotal,
    feeTotal: Math.round(feeTotal * 100) / 100,
    cargoTotal,
    cobroTotal,
    // Alineado a Hecom Club: deuda neta = cobrado − (gasto ads + fees)
    saldoEstimado: Math.round((cobroTotal - cargoTotal) * 100) / 100,
    creativeCount: creativosClientes.length,
    projectCount: creativosProyectos.length,
    depositFeePercent: feeResolved.feePercent,
    depositFeeSource: feeResolved.feeSource,
    ...dailySummary,
  };
}

async function loadGastosSpendMapForWindow(
  clientId: string,
  startDate: string,
): Promise<Map<string, number>> {
  try {
    const hecom = createHecomAdminClient();
    // Ventana amplia: no depender solo del listado UI (limit 80).
    const { data, error } = await hecom
      .from("gastos")
      .select("gasto,fecha_movimiento,tiktok_stat_date,mes,client_id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(4000);

    if (error || !data) return new Map();

    const rows = (data as Record<string, unknown>[])
      .filter((row) => String(row.client_id ?? "") === clientId)
      .map(mapGasto);

    const byDate = spendMapFromGastos(rows);
    // Recortar ruido muy viejo fuera de la ventana pedida.
    const trimmed = new Map<string, number>();
    for (const [date, spend] of byDate) {
      if (date >= startDate) trimmed.set(date, spend);
    }
    return trimmed;
  } catch {
    return new Map();
  }
}

async function resolveDailySpend(
  clientId: string,
  gastos: HecomGastoRow[],
  cfgConfigured: boolean,
): Promise<ReturnType<typeof buildDailySpendSummary>> {
  const today = calendarDateInTz();
  const start30 = shiftCalendarDate(
    today,
    -(Math.max(DAILY_SERIES_DAYS, 30) - 1),
  );

  let fromSnapshots: Map<string, number> | null = null;
  if (cfgConfigured) {
    fromSnapshots = await loadSnapshotSpendMap(clientId, start30);
  }

  // 1) listado ya cargado  2) query dedicada últimos ~30d (más completa)
  const fromList = spendMapFromGastos(gastos);
  const fromWindow = cfgConfigured
    ? await loadGastosSpendMapForWindow(clientId, start30)
    : new Map<string, number>();

  const fromGastos = new Map<string, number>();
  for (const [date, spend] of fromList) fromGastos.set(date, spend);
  for (const [date, spend] of fromWindow) {
    fromGastos.set(date, Math.max(fromGastos.get(date) ?? 0, spend));
  }

  const { byDate, source } = mergeDailySpendMaps(fromGastos, fromSnapshots);
  if (byDate.size === 0) return emptyDailySpendSummary();
  return buildDailySpendSummary(byDate, source);
}

async function loadLiveFinance(
  clientId: string,
  options: { includeCreativos?: boolean } = {},
): Promise<{
  gastos: HecomGastoRow[];
  cobros: HecomCobroRow[];
  creativosClientes: HecomCreativoCliente[];
  creativosProyectos: HecomCreativoProyecto[];
} | null> {
  const includeCreativos = options.includeCreativos !== false;
  try {
    const hecom = createHecomAdminClient();
    const financeQueries = [
      hecom
        .from("gastos")
        .select(
          "id,client_id,mes,camp,gasto,fee,source,fecha_movimiento,tiktok_stat_date,codigo,notas",
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(80),
      hecom
        .from("cobros")
        .select("id,client_id,monto,fecha,metodo,notas,codigo,created_at")
        .eq("client_id", clientId)
        .order("fecha", { ascending: false })
        .limit(80),
    ] as const;

    const [gastosRes, cobrosRes, creativosRes] = await Promise.all([
      ...financeQueries,
      includeCreativos
        ? hecom
            .from("creativos_clientes")
            .select("id,name,company,email,credito_client_id")
            .eq("credito_client_id", clientId)
            .limit(40)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const gastos = ((gastosRes.data ?? []) as Record<string, unknown>[])
      .filter((row) => String(row.client_id ?? "") === clientId)
      .map(mapGasto);
    const cobros = ((cobrosRes.data ?? []) as Record<string, unknown>[])
      .filter((row) => String(row.client_id ?? "") === clientId)
      .map(mapCobro);
    const creativosClientes = includeCreativos
      ? ((creativosRes.data ?? []) as Record<string, unknown>[])
          .filter((row) => String(row.credito_client_id ?? "") === clientId)
          .map(mapCreativoCliente)
      : [];

    let creativosProyectos: HecomCreativoProyecto[] = [];
    if (includeCreativos && creativosClientes.length > 0) {
      const ids = creativosClientes.map((c) => c.id);
      const proyectosRes = await hecom
        .from("creativos_proyectos")
        .select("id,name,client_id,type,platform,format,published")
        .in("client_id", ids)
        .limit(40);
      if (!proyectosRes.error) {
        creativosProyectos = (
          (proyectosRes.data ?? []) as Record<string, unknown>[]
        ).map(mapCreativoProyecto);
      }
    }

    // If all queries failed hard, treat as not live
    if (
      gastosRes.error &&
      cobrosRes.error &&
      (includeCreativos ? creativosRes.error : true)
    ) {
      return null;
    }

    return { gastos, cobros, creativosClientes, creativosProyectos };
  } catch {
    return null;
  }
}

function advertiserIdsFromAccounts(accounts: HecomTiktokAccount[]): string[] {
  return accounts
    .map((account) => account.advertiserId?.trim())
    .filter((id): id is string => Boolean(id));
}

/** Drop gastos whose camp advertiser id is not one of this cliente's accounts. */
function scopeGastosToAdvertisers(
  gastos: HecomGastoRow[],
  advertiserIds: string[],
): HecomGastoRow[] {
  const allowed = new Set(advertiserIds);
  if (allowed.size === 0) return gastos;

  return gastos.filter((row) => {
    const fromCamp = getAdvertiserIdFromCamp(row.camp)?.trim();
    if (!fromCamp) return true;
    return allowed.has(fromCamp);
  });
}

export const getHecomClienteDashboard = cache(
  async (clienteId: string): Promise<HecomClienteDashboard | null> => {
    try {
      const cliente = await getHecomCliente(clienteId);
      if (!cliente) return null;

      const accounts = resolveAccounts(cliente);
      const advertiserIds = advertiserIdsFromAccounts(accounts);

      // Demo OTP: UI vacía realista sin pegarle a Hecom finance.
      if (isOtpTestClienteId(clienteId)) {
        return {
          source: "hecom_backup",
          cliente,
          accounts,
          gastos: [],
          cobros: [],
          creativosClientes: [],
          creativosProyectos: [],
          summary: buildSummary(cliente, accounts, [], [], [], [], emptyDailySpendSummary()),
        };
      }

      const cfg = getHecomSupabaseConfig();

      if (cfg.configured) {
        const live = await loadLiveFinance(clienteId);
        if (live) {
          const gastos = scopeGastosToAdvertisers(live.gastos, advertiserIds);
          const cobros = live.cobros;
          const daily = await resolveDailySpend(clienteId, gastos, true);
          return {
            source: "hecom_live",
            cliente,
            accounts,
            gastos,
            cobros,
            creativosClientes: live.creativosClientes,
            creativosProyectos: live.creativosProyectos,
            summary: buildSummary(
              cliente,
              accounts,
              gastos,
              cobros,
              live.creativosClientes,
              live.creativosProyectos,
              daily,
            ),
          };
        }
      }

      const backup = await loadHecomBackupJson();
      if (!backup) {
        return {
          source: "hecom_backup",
          cliente,
          accounts,
          gastos: [],
          cobros: [],
          creativosClientes: [],
          creativosProyectos: [],
          summary: buildSummary(cliente, accounts, [], [], [], [], emptyDailySpendSummary()),
        };
      }

      const filtered = filterBackupByClient(backup.data, clienteId);
      const gastos = scopeGastosToAdvertisers(
        filtered.gastos.map(mapGasto),
        advertiserIds,
      );
      const cobros = filtered.cobros.map(mapCobro);
      const creativosClientes = filtered.creativosClientes.map(mapCreativoCliente);
      const creativosProyectos =
        filtered.creativosProyectos.map(mapCreativoProyecto);
      const daily = await resolveDailySpend(clienteId, gastos, cfg.configured);

      return {
        source: "hecom_backup",
        cliente,
        accounts,
        gastos,
        cobros,
        creativosClientes,
        creativosProyectos,
        summary: buildSummary(
          cliente,
          accounts,
          gastos,
          cobros,
          creativosClientes,
          creativosProyectos,
          daily,
        ),
      };
    } catch (error) {
      console.error("[hecom] getHecomClienteDashboard", {
        clienteId,
        error: error instanceof Error ? error.message : "unknown",
      });
      return null;
    }
  },
);

/** Sidebar / chrome: cliente + saldo, sin creativos (más rápido). */
export const getHecomClienteShell = cache(
  async (
    clienteId: string,
    options?: { includeSaldo?: boolean },
  ): Promise<{
    id: string;
    name: string;
    avatarUrl: string | null;
    saldoEstimado: number | null;
  } | null> => {
    try {
      const includeSaldo = options?.includeSaldo === true;
      const cliente = await getHecomCliente(clienteId);
      if (!cliente) return null;

      if (isOtpTestClienteId(clienteId)) {
        return {
          id: cliente.id,
          name: cliente.name,
          avatarUrl: cliente.avatarUrl,
          saldoEstimado: 0,
        };
      }

      // Navegación: default SOLO CRM (name/avatar). El saldo Hecom pesa en cada section.
      if (!includeSaldo) {
        return {
          id: cliente.id,
          name: cliente.name,
          avatarUrl: cliente.avatarUrl,
          saldoEstimado: null,
        };
      }

      const accounts = resolveAccounts(cliente);
      const advertiserIds = advertiserIdsFromAccounts(accounts);
      const cfg = getHecomSupabaseConfig();

      if (cfg.configured) {
        const live = await loadLiveFinance(clienteId, { includeCreativos: false });
        if (live) {
          const gastos = scopeGastosToAdvertisers(live.gastos, advertiserIds);
          const summary = buildSummary(cliente, accounts, gastos, live.cobros, [], []);
          return {
            id: cliente.id,
            name: cliente.name,
            avatarUrl: cliente.avatarUrl,
            saldoEstimado: summary.saldoEstimado,
          };
        }
      }

      return {
        id: cliente.id,
        name: cliente.name,
        avatarUrl: cliente.avatarUrl,
        saldoEstimado: null,
      };
    } catch (error) {
      console.error("[hecom] getHecomClienteShell", {
        clienteId,
        error: error instanceof Error ? error.message : "unknown",
      });
      return null;
    }
  },
);

export function moneyUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
