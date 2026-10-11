import { NextResponse } from "next/server";
import { radarApiContext, radarApiError } from "@/lib/radar/api-context.server";
import { getRadarProfile, saveRadarProfile } from "@/lib/radar/profiles.server";
import { generateRadarSeed } from "@/lib/radar/profile-seed.server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Estado del Radar del cliente seleccionado. La primera vez arma el perfil sugerido. */
export async function GET() {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;

  try {
    let profile = await getRadarProfile(ctx.clienteId);
    if (!profile?.seed) {
      const seed = await generateRadarSeed(ctx.clienteId);
      profile = await saveRadarProfile(ctx.clienteId, {
        seed,
        ...(profile ? {} : { onboardingStep: "pending" as const }),
      });
    }
    return NextResponse.json({
      ok: true,
      cliente: { id: ctx.clienteId, name: ctx.clienteName },
      isStaff: ctx.isStaff,
      profile,
    });
  } catch (error) {
    return radarApiError(error, "No se pudo cargar el Radar.");
  }
}
