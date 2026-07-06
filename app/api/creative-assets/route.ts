import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";

export const runtime = "nodejs";

const CREATIVE_ASSETS_BUCKET = "creative-assets";
const MAX_CREATIVE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "video/"];
const ALLOWED_MIME_TYPES = new Set(["application/pdf"]);

function sanitizeFileName(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return clean || "creative-asset";
}

function inferAssetType(mimeType: string): "image" | "video" | "document" | "other" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "document";
  return "other";
}

function isAllowedMimeType(mimeType: string): boolean {
  return (
    ALLOWED_MIME_TYPES.has(mimeType) ||
    ALLOWED_PREFIXES.some((prefix) => mimeType.startsWith(prefix))
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "creativeAnalyzer:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }
  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido." }, { status: 400 });
  }

  const asset = formData.get("asset");
  const requestedName = formData.get("name");
  if (!(asset instanceof File)) {
    return NextResponse.json({ error: "Archivo creativo requerido." }, { status: 400 });
  }
  if (asset.size <= 0) {
    return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });
  }
  if (asset.size > MAX_CREATIVE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "El creativo no puede superar 50 MB." },
      { status: 400 },
    );
  }

  const mimeType = asset.type || "application/octet-stream";
  if (!isAllowedMimeType(mimeType)) {
    return NextResponse.json(
      { error: "Formato no permitido. Sube una imagen, video o PDF." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const safeFileName = sanitizeFileName(asset.name);
  const displayName =
    typeof requestedName === "string" && requestedName.trim()
      ? requestedName.trim().slice(0, 120)
      : safeFileName;
  const storagePath = `${session.organizationId}/${Date.now()}-${safeFileName}`;
  const { error: uploadError } = await admin.storage
    .from(CREATIVE_ASSETS_BUCKET)
    .upload(storagePath, asset, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        error:
          uploadError.message ||
          "No se pudo subir el creativo. Verifica el bucket creative-assets.",
      },
      { status: 500 },
    );
  }

  const { data: creativeAsset, error: assetError } = await admin
    .from("creative_assets")
    .insert({
      organization_id: session.organizationId,
      name: displayName,
      asset_type: inferAssetType(mimeType),
      mime_type: mimeType,
      file_size_bytes: asset.size,
      storage_bucket: CREATIVE_ASSETS_BUCKET,
      storage_path: storagePath,
      status: "uploaded",
      metadata: { source: "dashboard", original_file_name: asset.name },
      created_by: session.id,
    })
    .select("id, name")
    .single<{ id: string; name: string }>();

  if (assetError || !creativeAsset) {
    await admin.storage.from(CREATIVE_ASSETS_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: assetError?.message ?? "No se pudo registrar el creativo." },
      { status: 500 },
    );
  }

  const { data: job, error: jobError } = await admin
    .from("creative_analysis_jobs")
    .insert({
      organization_id: session.organizationId,
      creative_asset_id: creativeAsset.id,
      status: "queued",
      provider: "internal",
      input: {
        source: "dashboard_upload",
        storage_bucket: CREATIVE_ASSETS_BUCKET,
        storage_path: storagePath,
      },
      requested_by: session.id,
    })
    .select("id, status")
    .single<{ id: string; status: string }>();

  if (jobError || !job) {
    return NextResponse.json(
      {
        error:
          jobError?.message ??
          "El creativo se subió, pero no se pudo crear el job de análisis.",
      },
      { status: 500 },
    );
  }

  await admin.from("audit_logs").insert({
    organization_id: session.organizationId,
    actor_user_id: session.id,
    action: "creative_asset.uploaded",
    entity_type: "creative_asset",
    entity_id: creativeAsset.id,
    metadata: { job_id: job.id, bucket: CREATIVE_ASSETS_BUCKET, path: storagePath },
  });

  await createNotificationBestEffort({
    organizationId: session.organizationId,
    userId: session.id,
    title: "Creativo subido",
    body: "Se creó un job de análisis en cola.",
    type: "creative_asset_uploaded",
    data: { creative_asset_id: creativeAsset.id, job_id: job.id, url: "/creative-analyzer" },
  });

  return NextResponse.json({
    ok: true,
    asset: creativeAsset,
    job,
  });
}
