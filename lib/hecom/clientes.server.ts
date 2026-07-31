import "server-only";
import {
  getHecomClienteFromBackup,
  listHecomClientesFromBackup,
} from "@/lib/hecom/backup.server";
import {
  createHecomAdminClient,
  getHecomSupabaseConfig,
} from "@/lib/hecom/supabase.server";

export type HecomCliente = {
  id: string;
  name: string;
  dni: string | null;
  emails: string[];
  phones: string[];
  biz: string | null;
  notes: string | null;
  ig: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  tiktokAdvertiserId: string | null;
  tiktokAdvertiserName: string | null;
  tiktokSyncEnabled: boolean | null;
  tiktokDefaultFee: number | null;
  tiktokAccounts: HecomTiktokAccount[];
};

export type HecomTiktokAccount = {
  advertiserId: string;
  advertiserName: string | null;
  bmBucket: string | null;
  fee: number | null;
  syncEnabled: boolean;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function mapClienteRow(
  row: Record<string, unknown>,
  accounts: HecomTiktokAccount[] = [],
): HecomCliente {
  return {
    id: String(row.id),
    name: String(row.name ?? "Sin nombre"),
    dni: row.dni ? String(row.dni) : null,
    emails: asStringArray(row.emails),
    phones: asStringArray(row.phones),
    biz: row.biz ? String(row.biz) : null,
    notes: row.notes ? String(row.notes) : null,
    ig: row.ig ? String(row.ig) : null,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
    tiktokAdvertiserId: row.tiktok_advertiser_id
      ? String(row.tiktok_advertiser_id)
      : null,
    tiktokAdvertiserName: row.tiktok_advertiser_name
      ? String(row.tiktok_advertiser_name)
      : null,
    tiktokSyncEnabled:
      typeof row.tiktok_sync_enabled === "boolean"
        ? row.tiktok_sync_enabled
        : null,
    tiktokDefaultFee:
      row.tiktok_default_fee != null && Number.isFinite(Number(row.tiktok_default_fee))
        ? Number(row.tiktok_default_fee)
        : null,
    tiktokAccounts: accounts,
  };
}

export async function listHecomClientes(): Promise<{
  source: "hecom_live" | "hecom_backup";
  hecomConfigured: boolean;
  clientes: HecomCliente[];
  backupPath?: string;
}> {
  const cfg = getHecomSupabaseConfig();
  if (!cfg.configured) {
    const backup = await listHecomClientesFromBackup();
    if (backup) {
      return {
        source: "hecom_backup",
        hecomConfigured: false,
        clientes: backup.clientes,
        backupPath: backup.path,
      };
    }
    throw new Error(
      "Hecom Club no configurado. Agregá HECOM_SUPABASE_SERVICE_ROLE_KEY en Vercel (service role del proyecto Hecom), o un backup Holistic-Backup-*.json accesible.",
    );
  }

  const hecom = createHecomAdminClient();

  // Prefer full TikTok columns; fall back to basic CRM fields.
  let rows: Record<string, unknown>[] = [];
  const full = await hecom
    .from("clientes")
    .select(
      "id,name,dni,emails,phones,biz,notes,ig,avatar_url,created_at,tiktok_advertiser_id,tiktok_advertiser_name,tiktok_sync_enabled,tiktok_default_fee",
    )
    .order("name", { ascending: true })
    .limit(500);

  if (full.error) {
    const basic = await hecom
      .from("clientes")
      .select("id,name,dni,emails,phones,biz,notes,ig,avatar_url,created_at")
      .order("name", { ascending: true })
      .limit(500);
    if (basic.error) {
      throw new Error(`Hecom clientes: ${basic.error.message}`);
    }
    rows = (basic.data ?? []) as Record<string, unknown>[];
  } else {
    rows = (full.data ?? []) as Record<string, unknown>[];
  }

  const accountsByClient = await loadTiktokAccountsByClient(
    rows.map((row) => String(row.id)),
  );

  const clientes = rows.map((row) =>
    mapClienteRow(row, accountsByClient.get(String(row.id)) ?? []),
  );

  return {
    source: "hecom_live",
    hecomConfigured: true,
    clientes,
  };
}

async function loadTiktokAccountsByClient(
  clientIds: string[],
): Promise<Map<string, HecomTiktokAccount[]>> {
  const map = new Map<string, HecomTiktokAccount[]>();
  if (clientIds.length === 0) return map;

  try {
    const hecom = createHecomAdminClient();
    const { data, error } = await hecom
      .from("cliente_tiktok_cuentas")
      .select("client_id,advertiser_id,advertiser_name,bm_bucket,fee,sync_enabled")
      .in("client_id", clientIds)
      .limit(2000);

    if (error || !data) return map;

    for (const row of data as Array<Record<string, unknown>>) {
      const clientId = String(row.client_id ?? "");
      const advertiserId = String(row.advertiser_id ?? "");
      if (!clientId || !advertiserId) continue;
      const list = map.get(clientId) ?? [];
      list.push({
        advertiserId,
        advertiserName: row.advertiser_name ? String(row.advertiser_name) : null,
        bmBucket: row.bm_bucket ? String(row.bm_bucket) : null,
        fee:
          row.fee != null && Number.isFinite(Number(row.fee))
            ? Number(row.fee)
            : null,
        syncEnabled: row.sync_enabled !== false,
      });
      map.set(clientId, list);
    }
  } catch {
    // Tabla multi-cuenta puede no existir aún
  }

  return map;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Clientes Hecom cuyo array `emails` contiene este correo (allowlist OTP). */
export async function findHecomClientesByEmail(
  email: string,
): Promise<HecomCliente[]> {
  const needle = normalizeEmail(email);
  if (!needle || !needle.includes("@")) return [];

  const cfg = getHecomSupabaseConfig();
  if (!cfg.configured) {
    const backup = await listHecomClientesFromBackup();
    if (!backup) return [];
    return backup.clientes.filter((cliente) =>
      cliente.emails.some((item) => normalizeEmail(item) === needle),
    );
  }

  const hecom = createHecomAdminClient();
  // Prefer Postgres contains on text[]; fall back to filtered list.
  const containsQuery = await hecom
    .from("clientes")
    .select(
      "id,name,dni,emails,phones,biz,notes,ig,avatar_url,created_at,tiktok_advertiser_id,tiktok_advertiser_name,tiktok_sync_enabled,tiktok_default_fee",
    )
    .contains("emails", [needle])
    .limit(50);

  if (!containsQuery.error && containsQuery.data) {
    const ids = containsQuery.data.map((row) => String((row as { id: string }).id));
    const accountsByClient = await loadTiktokAccountsByClient(ids);
    return (containsQuery.data as Record<string, unknown>[]).map((row) =>
      mapClienteRow(row, accountsByClient.get(String(row.id)) ?? []),
    );
  }

  // Case / format mismatch: scan limited list.
  const listed = await listHecomClientes();
  return listed.clientes.filter((cliente) =>
    cliente.emails.some((item) => normalizeEmail(item) === needle),
  );
}

export async function getHecomCliente(id: string): Promise<HecomCliente | null> {
  const cfg = getHecomSupabaseConfig();
  if (!cfg.configured) {
    return getHecomClienteFromBackup(id);
  }

  const hecom = createHecomAdminClient();
  const full = await hecom
    .from("clientes")
    .select(
      "id,name,dni,emails,phones,biz,notes,ig,avatar_url,created_at,tiktok_advertiser_id,tiktok_advertiser_name,tiktok_sync_enabled,tiktok_default_fee",
    )
    .eq("id", id)
    .maybeSingle();

  let row: Record<string, unknown> | null = null;
  if (full.error) {
    const basic = await hecom
      .from("clientes")
      .select("id,name,dni,emails,phones,biz,notes,ig,avatar_url,created_at")
      .eq("id", id)
      .maybeSingle();
    if (basic.error) throw new Error(`Hecom cliente: ${basic.error.message}`);
    row = (basic.data as Record<string, unknown> | null) ?? null;
  } else {
    row = (full.data as Record<string, unknown> | null) ?? null;
  }

  if (!row) return null;

  const accountsByClient = await loadTiktokAccountsByClient([id]);
  return mapClienteRow(row, accountsByClient.get(id) ?? []);
}

export async function listHecomClienteSpend(clientId: string, limit = 30) {
  try {
    const hecom = createHecomAdminClient();
    const { data, error } = await hecom
      .from("tiktok_spend_snapshots")
      .select(
        "id,client_id,advertiser_id,stat_date,spend,campaign_id,campaign_name,created_at",
      )
      .eq("client_id", clientId)
      .order("stat_date", { ascending: false })
      .limit(limit);

    if (error) {
      const gastos = await hecom
        .from("gastos")
        .select(
          "id,client_id,gasto,camp,mes,source,fecha_movimiento,fee,codigo,created_at",
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (gastos.error) return { kind: "none" as const, rows: [] };
      return {
        kind: "gastos" as const,
        rows: (gastos.data ?? []) as Array<Record<string, unknown>>,
      };
    }

    return {
      kind: "snapshots" as const,
      rows: (data ?? []) as Array<Record<string, unknown>>,
    };
  } catch {
    return { kind: "none" as const, rows: [] };
  }
}
