import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { HecomCliente, HecomTiktokAccount } from "@/lib/hecom/clientes.server";

const DEFAULT_BACKUP_CANDIDATES = [
  process.env.HECOM_CLIENTES_BACKUP_PATH?.trim(),
  // Latest known Holistic backups on this machine (Documentos)
  "C:\\Users\\Public\\Documents\\trabajos holistic\\hecom.club\\seguridad\\Holistic-Backup-2026-07-01-17-49.json",
  "C:\\Users\\Public\\Documents\\trabajos holistic\\hecom.club\\hecom-club\\Holistic-Backup-2026-05-12-03-50.json",
].filter(Boolean) as string[];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function mapBackupRow(row: Record<string, unknown>): HecomCliente {
  const accounts: HecomTiktokAccount[] = [];
  if (row.tiktok_advertiser_id) {
    accounts.push({
      advertiserId: String(row.tiktok_advertiser_id),
      advertiserName: row.tiktok_advertiser_name
        ? String(row.tiktok_advertiser_name)
        : null,
      bmBucket: row.tiktok_bc_id ? String(row.tiktok_bc_id) : null,
      fee:
        row.tiktok_default_fee != null &&
        Number.isFinite(Number(row.tiktok_default_fee))
          ? Number(row.tiktok_default_fee)
          : null,
      syncEnabled: row.tiktok_sync_enabled !== false,
    });
  }

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
      row.tiktok_default_fee != null &&
      Number.isFinite(Number(row.tiktok_default_fee))
        ? Number(row.tiktok_default_fee)
        : null,
    tiktokAccounts: accounts,
  };
}

export async function listHecomClientesFromBackup(): Promise<{
  source: "hecom_backup";
  path: string;
  clientes: HecomCliente[];
} | null> {
  for (const candidate of DEFAULT_BACKUP_CANDIDATES) {
    try {
      const absolute = path.resolve(candidate);
      const raw = await readFile(absolute, "utf8");
      const json = JSON.parse(raw) as { clientes?: unknown };
      if (!Array.isArray(json.clientes)) continue;
      const clientes = (json.clientes as Record<string, unknown>[])
        .map(mapBackupRow)
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      return { source: "hecom_backup", path: absolute, clientes };
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function getHecomClienteFromBackup(
  id: string,
): Promise<HecomCliente | null> {
  const pack = await listHecomClientesFromBackup();
  return pack?.clientes.find((c) => c.id === id) ?? null;
}
