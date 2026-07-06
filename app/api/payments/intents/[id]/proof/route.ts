import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { getPaymentIntentById, updatePaymentIntentRecord } from "@/lib/payments/payment-intents.server";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import { mergeMetadata } from "@/lib/records";

export const runtime = "nodejs";

const PAYMENT_PROOFS_BUCKET = "payment-proofs";
const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

function sanitizeFileName(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return clean || "voucher";
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (
    !hasPermission(session.permissions, "wallet:deposit") &&
    !hasPermission(session.permissions, "payments:create")
  ) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  const { id } = await context.params;
  const intent = await getPaymentIntentById(id, session.organizationId);
  if (!intent) {
    return NextResponse.json({ error: "Intención no encontrada." }, { status: 404 });
  }

  if (intent.provider !== "manual") {
    return NextResponse.json(
      { error: "El voucher solo aplica para pagos manuales." },
      { status: 400 },
    );
  }

  if (["succeeded", "cancelled"].includes(intent.status)) {
    return NextResponse.json(
      { error: "Esta intención ya no acepta comprobantes." },
      { status: 409 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido." }, { status: 400 });
  }

  const proof = formData.get("proof");
  if (!(proof instanceof File)) {
    return NextResponse.json({ error: "Comprobante requerido." }, { status: 400 });
  }

  if (proof.size <= 0) {
    return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });
  }

  if (proof.size > MAX_PROOF_SIZE_BYTES) {
    return NextResponse.json(
      { error: "El comprobante no puede superar 10 MB." },
      { status: 400 },
    );
  }

  if (proof.type && !ALLOWED_MIME_TYPES.has(proof.type)) {
    return NextResponse.json(
      { error: "Formato no permitido. Usa JPG, PNG, WEBP o PDF." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const safeName = sanitizeFileName(proof.name);
  const storagePath = `${session.organizationId}/${intent.id}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await admin.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(storagePath, proof, {
      contentType: proof.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        error:
          uploadError.message ||
          "No se pudo subir el comprobante. Verifica el bucket payment-proofs.",
      },
      { status: 500 },
    );
  }

  const submittedAt = new Date().toISOString();
  const metadata = mergeMetadata(intent.metadata, {
    manual_review_status: "pending_review",
    manual_proof: {
      bucket: PAYMENT_PROOFS_BUCKET,
      path: storagePath,
      file_name: safeName,
      mime_type: proof.type || null,
      size_bytes: proof.size,
      submitted_at: submittedAt,
      submitted_by: session.id,
    },
  });

  await updatePaymentIntentRecord(intent.id, {
    status: "processing",
    metadata,
  });

  await admin.from("audit_logs").insert({
    organization_id: session.organizationId,
    actor_user_id: session.id,
    action: "payment_intent.proof_uploaded",
    entity_type: "payment_intent",
    entity_id: intent.id,
    metadata: { bucket: PAYMENT_PROOFS_BUCKET, path: storagePath },
  });

  await createNotificationBestEffort({
    organizationId: session.organizationId,
    userId: session.id,
    title: "Comprobante enviado",
    body: "Tu pago manual quedó pendiente de revisión.",
    type: "payment_proof_uploaded",
    data: { payment_intent_id: intent.id, url: "/payments" },
  });

  return NextResponse.json({
    ok: true,
    paymentIntent: {
      id: intent.id,
      status: "processing",
      manualReviewStatus: "pending_review",
      proofFileName: safeName,
      submittedAt,
    },
  });
}
