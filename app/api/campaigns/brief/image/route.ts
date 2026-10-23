import { NextResponse } from "next/server";
import { requireCampaignUser } from "@/lib/campaigns/staff-guard.server";
import { BriefError, fetchProductImage } from "@/lib/campaigns/campaign-brief.server";

export const runtime = "nodejs";

/**
 * Foto del producto servida desde nuestro dominio: "Crear video" la dibuja en
 * un canvas que se graba, y una imagen de otro dominio lo bloquearía.
 */
export async function GET(request: Request) {
  const auth = await requireCampaignUser();
  if ("error" in auth) return auth.error;
  const url = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!url) return NextResponse.json({ error: "Falta el link de la foto." }, { status: 400 });
  try {
    const image = await fetchProductImage(url);
    return new NextResponse(new Uint8Array(image.body), {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof BriefError ? error.message : "No se pudo traer la foto.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
