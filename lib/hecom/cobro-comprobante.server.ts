import "server-only";
import {
  createHecomAdminClient,
  getHecomSupabaseConfig,
} from "@/lib/hecom/supabase.server";

const HECOM_COMPROBANTES_BUCKET = "comprobantes";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function normalizeStoragePath(path: string): string {
  return path.replace(/^\//, "").trim();
}

export function resolveHecomComprobantePublicUrl(storagePath: string): string {
  const cfg = getHecomSupabaseConfig();
  const objectPath = normalizeStoragePath(storagePath);
  return `${cfg.url}/storage/v1/object/public/${HECOM_COMPROBANTES_BUCKET}/${objectPath}`;
}

export async function signHecomCobroComprobanteUrl(
  storagePath: string,
): Promise<string> {
  const objectPath = normalizeStoragePath(storagePath);
  if (!objectPath) {
    throw new Error("Comprobante no disponible.");
  }

  const hecom = createHecomAdminClient();
  const { data, error } = await hecom.storage
    .from(HECOM_COMPROBANTES_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "No se pudo abrir el comprobante.");
  }

  if (data.signedUrl.startsWith("http")) {
    return data.signedUrl;
  }

  const cfg = getHecomSupabaseConfig();
  const relative = data.signedUrl.startsWith("/")
    ? data.signedUrl
    : `/${data.signedUrl}`;
  return `${cfg.url}/storage/v1${relative}`;
}
