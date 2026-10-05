import { NextResponse, type NextRequest } from "next/server";
import { getActivePartnerBySlug, recordPartnerVisit } from "@/lib/partners/partners.server";
import {
  PARTNER_COOKIE,
  PARTNER_COOKIE_MAX_AGE,
  VISITOR_COOKIE,
} from "@/lib/partners/partners.shared";

export const runtime = "nodejs";

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i;

/**
 * POST /api/partners/visit — la landing del aliado la llama al abrirse.
 * Cuenta la visita y deja dos cookies: quién trajo al visitante (para atribuir
 * el registro) y un id anónimo (para contar visitantes únicos).
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // body vacío: se responde igual
  }
  const str = (key: string) => (typeof body[key] === "string" ? String(body[key]).trim() || null : null);

  const partner = await getActivePartnerBySlug(str("slug"));
  if (!partner) return NextResponse.json({ ok: false }, { status: 404 });

  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value || crypto.randomUUID();
  await recordPartnerVisit({
    partnerId: partner.id,
    visitorId,
    path: str("path"),
    referrer: str("referrer"),
    utmSource: str("utm_source"),
    utmMedium: str("utm_medium"),
    utmCampaign: str("utm_campaign"),
    country: request.headers.get("x-vercel-ip-country"),
    device: MOBILE_UA.test(request.headers.get("user-agent") ?? "") ? "mobile" : "desktop",
  });

  const response = NextResponse.json({ ok: true });
  const cookie = { path: "/", maxAge: PARTNER_COOKIE_MAX_AGE, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", httpOnly: true };
  // El último aliado visitado es el que se lleva el registro (last click).
  response.cookies.set(PARTNER_COOKIE, partner.slug, cookie);
  response.cookies.set(VISITOR_COOKIE, visitorId, cookie);
  return response;
}
