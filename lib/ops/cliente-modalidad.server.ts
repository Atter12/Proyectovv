import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClienteModalidad, ClienteModalidadEntry } from "@/features/ops/types/prepago-monitor";

/**
 * Tipo de cliente para el monitoreo (lo marca gerencia):
 * - "prepago": solo gasta lo que recargó (la regla).
 * - "acuerdo": paga después, con acuerdo de gerencia (ej. Jesús Jiménez).
 *
 * Se guarda como un JSON privado en Supabase Storage para no tocar el
 * esquema: son pocos clientes, se edita a mano y así queda el historial.
 */

const BUCKET = "ops-config";
const PATH = "cliente-modalidad.json";
const HISTORY_MAX = 300;
const CACHE_MS = 20_000;

type ModalidadFile = {
  version: 1;
  clientes: Record<string, ClienteModalidadEntry>;
  history: Array<ClienteModalidadEntry & { clienteId: string }>;
};

let cache: { at: number; data: ModalidadFile } | null = null;

function empty(): ModalidadFile {
  return { version: 1, clientes: {}, history: [] };
}

async function readFile(): Promise<ModalidadFile> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(PATH);
  if (error || !data) return empty();
  try {
    const parsed = JSON.parse(await data.text()) as Partial<ModalidadFile>;
    return {
      version: 1,
      clientes: parsed.clientes ?? {},
      history: parsed.history ?? [],
    };
  } catch {
    return empty();
  }
}

export async function getClienteModalidades(
  options: { fresh?: boolean } = {},
): Promise<Record<string, ClienteModalidadEntry>> {
  if (!options.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.data.clientes;
  const data = await readFile();
  cache = { at: Date.now(), data };
  return data.clientes;
}

export async function setClienteModalidad(input: {
  clienteId: string;
  modalidad: ClienteModalidad;
  nota: string;
  by: string;
}): Promise<ClienteModalidadEntry> {
  const admin = createAdminClient();
  const file = await readFile();
  const entry: ClienteModalidadEntry = {
    modalidad: input.modalidad,
    nota: input.nota.trim().slice(0, 300),
    updatedAt: new Date().toISOString(),
    updatedBy: input.by,
  };
  file.clientes[input.clienteId] = entry;
  file.history = [{ clienteId: input.clienteId, ...entry }, ...file.history].slice(0, HISTORY_MAX);

  const body = JSON.stringify(file, null, 2);
  const upload = () =>
    admin.storage.from(BUCKET).upload(PATH, body, { upsert: true, contentType: "application/json" });
  let { error } = await upload();
  if (error && /bucket.*not.*found|not found/i.test(error.message)) {
    await admin.storage.createBucket(BUCKET, { public: false });
    ({ error } = await upload());
  }
  if (error) throw new Error(`No se pudo guardar el tipo de cliente: ${error.message}`);
  cache = { at: Date.now(), data: file };
  return entry;
}
