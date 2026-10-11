import { NextResponse } from "next/server";
import { radarApiContext, radarApiError } from "@/lib/radar/api-context.server";
import { getRadarProfile, saveRadarProfile } from "@/lib/radar/profiles.server";
import { isRadarCategory, isRadarObjective, normalizeAppearance } from "@/lib/radar/categories";

export const runtime = "nodejs";

/** Confirma rubro, productos, objetivo y quién sale en cámara; o salta el arranque. */
export async function POST(request: Request) {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    if (body.skip === true) {
      const profile = await saveRadarProfile(ctx.clienteId, { onboardingStep: "skipped" });
      return NextResponse.json({ ok: true, profile });
    }

    if (!isRadarCategory(body.categoryName)) {
      return NextResponse.json({ error: "Elige el rubro de tu negocio." }, { status: 400 });
    }
    const products = Array.isArray(body.products)
      ? body.products.map((p) => String(p ?? "").trim()).filter(Boolean).slice(0, 12)
      : [];
    const canAppear = normalizeAppearance(body.canAppear);
    if (canAppear.length === 0) {
      return NextResponse.json({ error: "Cuéntanos quién puede salir en tus videos." }, { status: 400 });
    }

    const current = await getRadarProfile(ctx.clienteId);
    // Rehacer preferencias o arrancar: en ambos casos se pasa a la ronda 1.
    const restart = body.restart === true || !current || ["pending", "categories", "skipped"].includes(current.onboardingStep);

    const profile = await saveRadarProfile(ctx.clienteId, {
      categoryName: body.categoryName,
      products,
      objective: isRadarObjective(body.objective) ? body.objective : null,
      canAppear,
      consentRadar: body.consentRadar === true,
      ...(restart ? { onboardingStep: "round1" as const } : {}),
    });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return radarApiError(error, "No se pudo guardar tu perfil.");
  }
}
