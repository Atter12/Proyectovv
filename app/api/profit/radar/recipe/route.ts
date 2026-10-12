import { NextResponse } from "next/server";
import { radarApiContext, radarApiError } from "@/lib/radar/api-context.server";
import { generateRadarRecipe, listRadarRecipes } from "@/lib/radar/recipe.server";

export const runtime = "nodejs";
// Si no llegan videos elegidos, busca referencias en vivo antes de pedir la receta.
export const maxDuration = 120;

/** Recetas anteriores del cliente seleccionado (la más reciente primero). */
export async function GET() {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;
  try {
    const recipes = await listRadarRecipes(ctx.clienteId);
    return NextResponse.json({ ok: true, recipes });
  } catch (error) {
    return radarApiError(error, "No se pudieron cargar tus recetas.");
  }
}

/** Arma una receta nueva para un producto del cliente (con los videos elegidos, firmados). */
export async function POST(request: Request) {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as { product?: unknown; picks?: unknown };
  const product = typeof body.product === "string" ? body.product.trim().slice(0, 80) : null;
  const picks = Array.isArray(body.picks) ? body.picks.slice(0, 12) : [];

  try {
    const recipe = await generateRadarRecipe({ hecomClienteId: ctx.clienteId, product, picks });
    return NextResponse.json({ ok: true, recipe });
  } catch (error) {
    return radarApiError(error, "No se pudo armar tu receta.");
  }
}
