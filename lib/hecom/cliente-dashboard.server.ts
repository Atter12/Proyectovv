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
  };
};

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
  return {
    id: String(row.id ?? ""),
    camp: row.camp ? String(row.camp) : null,
    gasto: Number(row.gasto ?? row.monto ?? 0) || 0,
    fee: row.fee != null && Number.isFinite(Number(row.fee)) ? Number(row.fee) : null,
    mes: row.mes ? String(row.mes) : null,
    source: row.source ? String(row.source) : null,
    fecha: row.fecha_movimiento
      ? String(row.fecha_movimiento)
      : row.tiktok_stat_date
        ? String(row.tiktok_stat_date)
        : row.mes
          ? String(row.mes)
          : null,
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

function buildSummary(
  accounts: HecomTiktokAccount[],
  gastos: HecomGastoRow[],
  cobros: HecomCobroRow[],
  creativosClientes: HecomCreativoCliente[],
  creativosProyectos: HecomCreativoProyecto[],
) {
  const fallbackFeePct =
    accounts.find((a) => a.fee != null)?.fee ??
    null;
  const gastoTotal = gastos.reduce((sum, row) => sum + row.gasto, 0);
  const feeTotal = gastos.reduce(
    (sum, row) => sum + feeAmountForGasto(row, fallbackFeePct),
    0,
  );
  const cargoTotal = Math.round((gastoTotal + feeTotal) * 100) / 100;
  const cobroTotal = cobros.reduce((sum, row) => sum + row.monto, 0);
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
  };
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
          summary: buildSummary(accounts, [], [], [], []),
        };
      }

      const cfg = getHecomSupabaseConfig();

      if (cfg.configured) {
        const live = await loadLiveFinance(clienteId);
        if (live) {
          const gastos = scopeGastosToAdvertisers(live.gastos, advertiserIds);
          const cobros = live.cobros;
          return {
            source: "hecom_live",
            cliente,
            accounts,
            gastos,
            cobros,
            creativosClientes: live.creativosClientes,
            creativosProyectos: live.creativosProyectos,
            summary: buildSummary(
              accounts,
              gastos,
              cobros,
              live.creativosClientes,
              live.creativosProyectos,
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
          summary: buildSummary(accounts, [], [], [], []),
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

      return {
        source: "hecom_backup",
        cliente,
        accounts,
        gastos,
        cobros,
        creativosClientes,
        creativosProyectos,
        summary: buildSummary(
          accounts,
          gastos,
          cobros,
          creativosClientes,
          creativosProyectos,
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
          const summary = buildSummary(accounts, gastos, live.cobros, [], []);
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
