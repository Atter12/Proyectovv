import "server-only";
import {
  filterBackupByClient,
  loadHecomBackupJson,
} from "@/lib/hecom/backup-data.server";
import {
  getHecomCliente,
  type HecomCliente,
  type HecomTiktokAccount,
} from "@/lib/hecom/clientes.server";
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
    cobroTotal: number;
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

function buildSummary(
  accounts: HecomTiktokAccount[],
  gastos: HecomGastoRow[],
  cobros: HecomCobroRow[],
  creativosClientes: HecomCreativoCliente[],
  creativosProyectos: HecomCreativoProyecto[],
) {
  const gastoTotal = gastos.reduce((sum, row) => sum + row.gasto, 0);
  const cobroTotal = cobros.reduce((sum, row) => sum + row.monto, 0);
  return {
    accountCount: accounts.length,
    gastoTotal,
    cobroTotal,
    saldoEstimado: cobroTotal - gastoTotal,
    creativeCount: creativosClientes.length,
    projectCount: creativosProyectos.length,
  };
}

async function loadLiveFinance(clientId: string): Promise<{
  gastos: HecomGastoRow[];
  cobros: HecomCobroRow[];
  creativosClientes: HecomCreativoCliente[];
  creativosProyectos: HecomCreativoProyecto[];
} | null> {
  try {
    const hecom = createHecomAdminClient();
    const [gastosRes, cobrosRes, creativosRes] = await Promise.all([
      hecom
        .from("gastos")
        .select(
          "id,client_id,mes,camp,gasto,fee,source,fecha_movimiento,tiktok_stat_date,codigo",
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
      hecom
        .from("creativos_clientes")
        .select("id,name,company,email,credito_client_id")
        .eq("credito_client_id", clientId)
        .limit(40),
    ]);

    const gastos = ((gastosRes.data ?? []) as Record<string, unknown>[]).map(
      mapGasto,
    );
    const cobros = ((cobrosRes.data ?? []) as Record<string, unknown>[]).map(
      mapCobro,
    );
    const creativosClientes = (
      (creativosRes.data ?? []) as Record<string, unknown>[]
    ).map(mapCreativoCliente);

    let creativosProyectos: HecomCreativoProyecto[] = [];
    if (creativosClientes.length > 0) {
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
    if (gastosRes.error && cobrosRes.error && creativosRes.error) {
      return null;
    }

    return { gastos, cobros, creativosClientes, creativosProyectos };
  } catch {
    return null;
  }
}

export async function getHecomClienteDashboard(
  clienteId: string,
): Promise<HecomClienteDashboard | null> {
  const cliente = await getHecomCliente(clienteId);
  if (!cliente) return null;

  const accounts = resolveAccounts(cliente);
  const cfg = getHecomSupabaseConfig();

  if (cfg.configured) {
    const live = await loadLiveFinance(clienteId);
    if (live) {
      return {
        source: "hecom_live",
        cliente,
        accounts,
        gastos: live.gastos,
        cobros: live.cobros,
        creativosClientes: live.creativosClientes,
        creativosProyectos: live.creativosProyectos,
        summary: buildSummary(
          accounts,
          live.gastos,
          live.cobros,
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
  const gastos = filtered.gastos.map(mapGasto);
  const cobros = filtered.cobros.map(mapCobro);
  const creativosClientes = filtered.creativosClientes.map(mapCreativoCliente);
  const creativosProyectos = filtered.creativosProyectos.map(mapCreativoProyecto);

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
}

export function moneyUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
