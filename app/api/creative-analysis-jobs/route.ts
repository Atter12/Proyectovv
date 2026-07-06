import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";

interface CreateJobBody {
  assetId?: unknown;
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

  let body: CreateJobBody;
  try {
    body = (await request.json()) as CreateJobBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
  if (!assetId) {
    return NextResponse.json({ error: "assetId requerido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: asset, error: assetError } = await admin
    .from("creative_assets")
    .select("id, name")
    .eq("id", assetId)
    .eq("organization_id", session.organizationId)
    .maybeSingle<{ id: string; name: string }>();

  if (assetError) {
    return NextResponse.json({ error: assetError.message }, { status: 500 });
  }
  if (!asset) {
    return NextResponse.json({ error: "Creativo no encontrado." }, { status: 404 });
  }

  const { data: job, error: jobError } = await admin
    .from("creative_analysis_jobs")
    .insert({
      organization_id: session.organizationId,
      creative_asset_id: asset.id,
      status: "queued",
      provider: "internal",
      input: { source: "dashboard_reanalysis" },
      requested_by: session.id,
    })
    .select("id, status")
    .single<{ id: string; status: string }>();

  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError?.message ?? "No se pudo crear el job." },
      { status: 500 },
    );
  }

  await createNotificationBestEffort({
    organizationId: session.organizationId,
    userId: session.id,
    title: "Nuevo análisis en cola",
    body: asset.name,
    type: "creative_analysis_queued",
    data: { creative_asset_id: asset.id, job_id: job.id, url: "/creative-analyzer" },
  });

  return NextResponse.json({ ok: true, job });
}
