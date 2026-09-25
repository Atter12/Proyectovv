type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 10 * 1024 * 1024;
export type PaymentProofReference = { path: string; kind: "image" | "pdf" | "file" };
function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

/** Only an object uploaded beneath this payment and organization is signable. */
export function paymentProofReference(payment: Row): PaymentProofReference | null {
  if (typeof payment.id !== "string" || !UUID.test(payment.id) ||
      typeof payment.organization_id !== "string" || !UUID.test(payment.organization_id)) return null;
  const proof = record(record(payment.metadata).manual_proof);
  if (proof.bucket != null && proof.bucket !== "payment-proofs") return null;
  const path = typeof proof.path === "string" ? proof.path : proof.storage_path;
  if (typeof path !== "string") return null;
  const prefix = `${payment.organization_id}/${payment.id}/`;
  if (!path.startsWith(prefix)) return null;
  const filename = path.slice(prefix.length);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(filename)) return null;
  if (proof.size_bytes != null && (typeof proof.size_bytes !== "number" || !Number.isSafeInteger(proof.size_bytes) ||
      proof.size_bytes <= 0 || proof.size_bytes > MAX_BYTES)) return null;
  const mime = typeof proof.mime_type === "string" ? proof.mime_type.toLowerCase() : "";
  const ext = filename.split(".").pop()?.toLowerCase();
  const imageMime = ["image/jpeg", "image/png", "image/webp"].includes(mime);
  const imageExt = ["jpg", "jpeg", "png", "webp"].includes(ext ?? "");
  const unknownMime = !mime || mime === "application/octet-stream";
  return { path, kind: imageExt && (imageMime || unknownMime) ? "image" :
    ext === "pdf" && (mime === "application/pdf" || unknownMime) ? "pdf" : "file" };
}

/** The storage signer must return this original object's URL, never a redirect. */
export function validSignedPaymentProofUrl(value: unknown, supabaseUrl: string, path: string): value is string {
  if (typeof value !== "string" || value.length > 10_000) return false;
  try {
    const own = new URL(supabaseUrl), signed = new URL(value);
    return own.protocol === "https:" && signed.protocol === "https:" && signed.origin === own.origin &&
      !signed.username && !signed.password && !signed.hash &&
      signed.pathname === `/storage/v1/object/sign/payment-proofs/${path}` &&
      signed.searchParams.getAll("token").length === 1 && Boolean(signed.searchParams.get("token")) &&
      [...signed.searchParams.keys()].every(key => key === "token");
  } catch { return false; }
}
