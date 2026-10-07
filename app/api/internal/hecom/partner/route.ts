import { serverEnv } from "@/lib/env/env.server";
import { authenticateHecomPaymentRead, hecomPaymentReadResponse as reply } from "@/lib/hecom/payment-detail.server";
import {
  createAlliancePartner,
  getAlliancePartner,
  isAllianceId,
} from "@/lib/partners/hecom-alliance-bridge.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Aliado de Ads Holistic de una alianza de Hecom.
 * GET  ?allianceId=<uuid>  → { ok, partner | null }
 * POST { allianceId, name, slug?, whatsapp?, commissionPercent?, commissionDays?, hecomClienteId?, contractSignedAt? }
 * Auth: Bearer con el mismo secreto del puente de cobros.
 */
function guard(request: Request): Response | null {
  const secret = serverEnv.hecomCobrosBridgeSecret;
  if (!secret) return reply({ ok: false, error: "bridge_not_configured" }, 503);
  if (!authenticateHecomPaymentRead(request, secret)) return reply({ ok: false, error: "unauthorized" }, 401);
  return null;
}

export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const allianceId = new URL(request.url).searchParams.get("allianceId");
  if (!isAllianceId(allianceId)) return reply({ ok: false, error: "invalid_alliance" }, 400);
  try {
    return reply({ ok: true, partner: await getAlliancePartner(allianceId) });
  } catch (error) {
    console.error("[internal/hecom/partner] get_failed", error);
    return reply({ ok: false, error: "read_failed" }, 500);
  }
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return reply({ ok: false, error: "invalid_body" }, 400);
  }
  if (!isAllianceId(body.allianceId)) return reply({ ok: false, error: "invalid_alliance" }, 400);
  const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
  try {
    const result = await createAlliancePartner({
      allianceId: body.allianceId,
      name: String(body.name ?? ""),
      slug: typeof body.slug === "string" ? body.slug : null,
      whatsapp: typeof body.whatsapp === "string" ? body.whatsapp : null,
      commissionPercent: num(body.commissionPercent),
      commissionDays: num(body.commissionDays),
      hecomClienteId: typeof body.hecomClienteId === "string" ? body.hecomClienteId : null,
      contractSignedAt: typeof body.contractSignedAt === "string" ? body.contractSignedAt : null,
    });
    if (!result.ok) return reply({ ok: false, error: result.error }, result.status);
    return reply({ ok: true, created: result.created, partner: result.partner }, result.created ? 201 : 200);
  } catch (error) {
    console.error("[internal/hecom/partner] create_failed", error);
    return reply({ ok: false, error: "create_failed" }, 500);
  }
}
