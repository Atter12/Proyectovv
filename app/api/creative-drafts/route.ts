import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  approveCreativeDraft,
  publishApprovedCreativeDraft,
  rejectCreativeDraft,
} from "@/lib/creatives/drafts.server";
import { listOrganizationCreativeDrafts } from "@/lib/creatives/list-creatives.server";
import { isTikTokCreativePublishEnabled } from "@/lib/integrations/tiktok/creative-publish.server";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "creativeAnalyzer:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }
  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  const drafts = await listOrganizationCreativeDrafts(session.organizationId);
  return NextResponse.json({
    ok: true,
    drafts,
    publishEnabled: isTikTokCreativePublishEnabled(),
  });
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

  let body: { draftId?: string; action?: string; publish?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const draftId = typeof body.draftId === "string" ? body.draftId.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (
    !draftId ||
    (action !== "approve" && action !== "reject" && action !== "publish")
  ) {
    return NextResponse.json(
      { error: "draftId y action (approve|reject|publish) requeridos." },
      { status: 400 },
    );
  }

  try {
    if (action === "reject") {
      await rejectCreativeDraft({
        organizationId: session.organizationId,
        draftId,
        userId: session.id,
      });
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    if (action === "publish") {
      const result = await publishApprovedCreativeDraft({
        organizationId: session.organizationId,
        draftId,
        userId: session.id,
      });
      return NextResponse.json({
        ok: true,
        ...result,
        publishEnabled: isTikTokCreativePublishEnabled(),
      });
    }

    const result = await approveCreativeDraft({
      organizationId: session.organizationId,
      draftId,
      userId: session.id,
      publish: Boolean(body.publish),
    });
    return NextResponse.json({
      ok: true,
      ...result,
      publishEnabled: isTikTokCreativePublishEnabled(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar el borrador.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
