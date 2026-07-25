import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BACKUP_CANDIDATES = [
  process.env.HECOM_CLIENTES_BACKUP_PATH?.trim(),
  "C:\\Users\\Public\\Documents\\trabajos holistic\\hecom.club\\seguridad\\Holistic-Backup-2026-07-01-17-49.json",
  "C:\\Users\\Public\\Documents\\trabajos holistic\\hecom.club\\hecom-club\\Holistic-Backup-2026-05-12-03-50.json",
].filter(Boolean) as string[];

type BackupJson = {
  clientes?: Record<string, unknown>[];
  gastos?: Record<string, unknown>[];
  cobros?: Record<string, unknown>[];
  garantias?: Record<string, unknown>[];
  creativos_clientes?: Record<string, unknown>[];
  creativos_proyectos?: Record<string, unknown>[];
};

let cached: { path: string; data: BackupJson } | null = null;

export async function loadHecomBackupJson(): Promise<{
  path: string;
  data: BackupJson;
} | null> {
  if (cached) return cached;

  for (const candidate of DEFAULT_BACKUP_CANDIDATES) {
    try {
      const absolute = path.resolve(candidate);
      const raw = await readFile(absolute, "utf8");
      const data = JSON.parse(raw) as BackupJson;
      if (!Array.isArray(data.clientes)) continue;
      cached = { path: absolute, data };
      return cached;
    } catch {
      // try next
    }
  }
  return null;
}

export function filterBackupByClient(
  data: BackupJson,
  clientId: string,
): {
  gastos: Record<string, unknown>[];
  cobros: Record<string, unknown>[];
  garantias: Record<string, unknown>[];
  creativosClientes: Record<string, unknown>[];
  creativosProyectos: Record<string, unknown>[];
} {
  const gastos = (data.gastos ?? []).filter(
    (row) => String(row.client_id ?? "") === clientId,
  );
  const cobros = (data.cobros ?? []).filter(
    (row) => String(row.client_id ?? "") === clientId,
  );
  const garantias = (data.garantias ?? []).filter(
    (row) => String(row.client_id ?? "") === clientId,
  );
  const creativosClientes = (data.creativos_clientes ?? []).filter(
    (row) => String(row.credito_client_id ?? "") === clientId,
  );
  const creativeIds = new Set(creativosClientes.map((row) => String(row.id)));
  const creativosProyectos = (data.creativos_proyectos ?? []).filter((row) =>
    creativeIds.has(String(row.client_id ?? "")),
  );

  return { gastos, cobros, garantias, creativosClientes, creativosProyectos };
}
