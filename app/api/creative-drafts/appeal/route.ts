import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { appealSmartPlusAd } from "@/lib/integrations/tiktok/ad-appeal.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "creativeAnalyzer:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }
  if (!session.organizationId) {
    return NextResponse.json(
      { error: "Organización no disponible." },
      { status: 400 },
    );
  }

  let body: { draftId?: string; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const draftId = typeof body.draftId === "string" ? body.draftId.trim() : "";
  const reason =
    typeof body.reason === "string"
      ? body.reason.trim()
      : "Revisé el creativo y la página. Solicito una nueva revisión.";
  if (!draftId) {
    return NextResponse.json({ error: "draftId requerido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: draft, error } = await admin
    .from("creative_publish_drafts")
    .select(
      "id, organization_id, external_advertiser_id, external_ad_id, publish_result, reject_reasons",
    )
    .eq("id", draftId)
    .eq("organization_id", session.organizationId)
    .maybeSingle<{
      id: string;
      organization_id: string;
      external_advertiser_id: string | null;
      external_ad_id: string | null;
      publish_result: Record<string, unknown> | null;
      reject_reasons: unknown;
    }>();

  if (error || !draft) {
    return NextResponse.json({ error: "Draft no encontrado." }, { status: 404 });
  }

  const advertiserId = String(draft.external_advertiser_id ?? "").trim();
  const smartPlusAdId = String(
    draft.external_ad_id ??
      draft.publish_result?.smart_plus_ad_id ??
      draft.publish_result?.ad_id ??
      "",
  ).trim();
  if (!advertiserId || !smartPlusAdId) {
    return NextResponse.json(
      { error: "Este anuncio no tiene ID Smart+ para apelar." },
      { status: 400 },
    );
  }

  const result = await appealSmartPlusAd({
    organizationId: session.organizationId,
    advertiserId,
    smartPlusAdId,
    appealReason: reason,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  const publish = {
    ...(draft.publish_result ?? {}),
    appeal_status: "APPEALING",
    appealed_at: new Date().toISOString(),
    appeal_reason_sent: reason.slice(0, 512),
  };
  await admin
    .from("creative_publish_drafts")
    .update({ publish_result: publish, updated_at: new Date().toISOString() })
    .eq("id", draft.id);

  return NextResponse.json({ ok: true, appealStatus: "APPEALING" });
}
