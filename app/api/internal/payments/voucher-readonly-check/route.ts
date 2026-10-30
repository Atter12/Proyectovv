import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManualBankAccounts } from "@/lib/payments/manual-bank-accounts.server";
import { analyzePaymentVoucher, hashVoucherBuffer } from "@/lib/payments/voucher-analysis.server";
import { checkDuplicateVoucherHash, checkDuplicateOperationCode, checkVoucherUploadRateLimits, normalizeOperationCode } from "@/lib/payments/voucher-security.server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// TEMPORARY deployment verification. No intent, proof, notification or ledger
// writes. Expiration also closes access if cleanup is interrupted.
const EXPIRES = Date.parse("2026-10-30T19:23:00Z");
const FIXTURES = new Set([
  "7cf369dc-179b-4184-a035-0b1453f318cc",
  "bee1c6d3-b39a-440e-91c1-f273a9283244",
  "a721b2f8-27c6-4750-8ece-63db3ba63bc5",
  "e0444d68-ee36-455b-ae60-e3ea8c1dca2a",
  "e0081fe1-38fb-489c-9f61-fcede21e9ab4",
]);
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
function respond(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function authorized(request: Request) {
  const expected = serverEnv.cronSecret;
  const actual = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || !actual || Date.now() > EXPIRES) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function GET(request: Request) {
  if (!authorized(request)) return respond({ error: "No autorizado." }, 401);
  return respond({ readOnly: true, expiresAt: new Date(EXPIRES).toISOString(),
    aiEnabled: Boolean(serverEnv.openAiApiKey?.trim()), model: serverEnv.manualVoucherVisionModel,
    accounts: getManualBankAccounts(), credited: false, persisted: false });
}
export async function POST(request: Request) {
  if (!authorized(request)) return respond({ error: "No autorizado." }, 401);
  const length = Number(request.headers.get("content-length"));
  if (length > 11 * 1024 * 1024) return respond({ error: "El comprobante no puede superar 10 MB." }, 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return respond({ error: "Formulario inválido." }, 400); }
  const id = String(form.get("fixtureId") ?? "");
  if (!FIXTURES.has(id)) return respond({ error: "Caso de comprobación no permitido." }, 400);
  const db = createAdminClient();
  const { data: intent, error } = await db.from("payment_intents")
    .select("id,organization_id,status,provider,amount_cents,metadata").eq("id", id).single();
  if (error || !intent || intent.provider !== "manual" || intent.status !== "succeeded" || intent.metadata?.source !== "dashboard") {
    return respond({ error: "Referencia aprobada no disponible." }, 400);
  }
  const meta = intent.metadata;
  const currencyOverride = form.get("currency");
  if (currencyOverride !== null && currencyOverride !== "PEN" && currencyOverride !== "USD") {
    return respond({ error: "Moneda inválida." }, 400);
  }
  const currency = currencyOverride ?? (meta.charge_currency === "PEN" ? "PEN" : "USD");
  const amount = form.has("amount") ? Number(form.get("amount"))
    : Number(currency === "PEN" ? meta.gross_pen_cents ?? intent.amount_cents : intent.amount_cents) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return respond({ error: "Monto inválido." }, 400);
  let buffer: Buffer, mimeType: string;
  const file = form.get("proof");
  if (file !== null) {
    if (!(file instanceof File)) return respond({ error: "Comprobante requerido." }, 400);
    if (!file.size) return respond({ error: "El archivo está vacío." }, 400);
    if (file.size > 10 * 1024 * 1024) return respond({ error: "El comprobante no puede superar 10 MB." }, 400);
    if (!TYPES.has(file.type)) return respond({ error: "Formato no permitido. Usa JPG, PNG, WEBP o PDF." }, 400);
    buffer = Buffer.from(await file.arrayBuffer()); mimeType = file.type;
  } else {
    const proof = meta.manual_proof;
    const { data, error: downloadError } = await db.storage.from("payment-proofs").download(proof.path ?? proof.storage_path);
    if (downloadError || !data) return respond({ error: "No se pudo leer la referencia." }, 503);
    buffer = Buffer.from(await data.arrayBuffer()); mimeType = data.type;
  }
  const analysis = await analyzePaymentVoucher({ buffer, mimeType, expectedAmount: amount,
    expectedCurrency: currency, strictCurrency: true, destinationAccounts: getManualBankAccounts(currency) });
  // Exclude the original only when replaying it; testDuplicate uses a new ID
  // so the already approved original must be found by production deduplication.
  const exclude = form.get("testDuplicate") === "true" ? "00000000-0000-0000-0000-000000000000" : id;
  const operation = normalizeOperationCode(analysis.operationCode);
  const [hash, op, limits] = await Promise.all([
    checkDuplicateVoucherHash(hashVoucherBuffer(buffer), exclude),
    operation ? checkDuplicateOperationCode(operation, exclude) : Promise.resolve({ duplicate: false, checkFailed: false }),
    checkVoucherUploadRateLimits(intent.organization_id),
  ]);
  return respond({ readOnly: true, analysis,
    security: { duplicateContentHash: hash.duplicate, duplicateOperationCode: op.duplicate,
      duplicateCheckFailed: hash.checkFailed || op.checkFailed, rateLimitBlocksAutoApprove: !limits.autoApproveAllowed },
    passesForHypotheticalOpenIntent: analysis.confirmed && !hash.duplicate && !op.duplicate &&
      !hash.checkFailed && !op.checkFailed && limits.uploadAllowed && limits.autoApproveAllowed,
    originalIntentAlreadyApproved: true, credited: false, persisted: false,
    note: "El caso original permanece aprobado. No se ejecuta procesamiento ni acreditación; solo se comprueban reglas para una intención abierta hipotética." });
}
