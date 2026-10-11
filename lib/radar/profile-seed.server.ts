import "server-only";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import { getLinkedStoresForCliente } from "@/lib/realprofit/profit-snapshot.server";
import { OTHERS, productFromCampaignName } from "@/lib/realprofit/product-performance";
import { createAdminClient } from "@/lib/supabase/admin";
import { callOpenAiJson } from "@/lib/radar/openai.server";
import { parseSeed, type RadarSeed } from "@/lib/radar/profiles.server";
import { RADAR_CATEGORIES, RADAR_OBJECTIVES } from "@/lib/radar/categories";
import { TAG_DIMENSIONS } from "@/lib/radar/tags";

/**
 * Perfil sugerido antes de la ronda 1, con lo que Ads Holistic ya sabe del
 * cliente: giro y notas de Hecom, Instagram, productos de sus campañas,
 * tienda vinculada y nombres de sus anuncios. El cliente lo confirma o corrige.
 * Si la IA no responde, se devuelve lo que se pueda deducir sin ella.
 */

type SeedInputs = {
  name: string;
  business: string | null;
  notes: string | null;
  instagram: string | null;
  products: string[];
  adNames: string[];
  storeDomains: string[];
  sources: string[];
};

async function gatherInputs(hecomClienteId: string): Promise<SeedInputs> {
  const sources: string[] = [];
  const cliente = await getHecomCliente(hecomClienteId).catch(() => null);
  if (cliente?.biz || cliente?.notes) sources.push("ficha_hecom");
  if (cliente?.ig) sources.push("instagram");

  const admin = createAdminClient();
  const since = shiftYmd(todayYmdInTz("America/Lima"), -60);
  const { data: ads } = await admin
    .from("radar_ad_daily")
    .select("campaign_name, ad_name, spend")
    .eq("hecom_cliente_id", hecomClienteId)
    .gte("stat_date", since)
    .order("spend", { ascending: false })
    .limit(200);

  const productSpend = new Map<string, number>();
  const adNames: string[] = [];
  for (const row of (ads ?? []) as Array<{ campaign_name: string | null; ad_name: string | null; spend: number }>) {
    const product = productFromCampaignName(row.campaign_name);
    if (product !== OTHERS) productSpend.set(product, (productSpend.get(product) ?? 0) + Number(row.spend ?? 0));
    if (row.ad_name && adNames.length < 15 && !adNames.includes(row.ad_name)) adNames.push(row.ad_name);
  }
  if (productSpend.size > 0) sources.push("campanas");

  const stores = await getLinkedStoresForCliente(hecomClienteId).catch(() => []);
  const storeDomains = stores.map((s) => s.shopDomain).filter((d): d is string => Boolean(d));
  if (storeDomains.length > 0) sources.push("tienda");

  return {
    name: cliente?.name ?? "",
    business: cliente?.biz ?? null,
    notes: cliente?.notes?.slice(0, 600) ?? null,
    instagram: cliente?.ig ?? null,
    products: [...productSpend.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p).slice(0, 8),
    adNames,
    storeDomains,
    sources,
  };
}

const SYSTEM = `Ayudas a armar el perfil de un vendedor peruano que anuncia en TikTok.
Con los datos que recibes, sugiere:
- categoryName: una de ${RADAR_CATEGORIES.join(" | ")} (o null si no se puede saber)
- products: hasta 6 productos que vende, nombres cortos en español
- objective: ${RADAR_OBJECTIVES.join(" | ")} (o null). messages = le escriben por WhatsApp/mensajes; sales = vende en web/tienda; followers = busca seguidores
- currentStyle: estilo probable de sus videos, solo dimensiones que puedas deducir. Valores permitidos:
${Object.entries(TAG_DIMENSIONS).map(([d, v]) => `  ${d}: ${v.join(" | ")}`).join("\n")}
- summary: una frase en español sobre qué vende y a quién
No inventes. Responde JSON con esas claves.`;

export async function generateRadarSeed(hecomClienteId: string): Promise<RadarSeed> {
  const inputs = await gatherInputs(hecomClienteId);
  const fallback: RadarSeed = {
    categoryName: null,
    products: inputs.products.slice(0, 6),
    objective: null,
    currentStyle: {},
    summary: "",
    sources: inputs.sources,
    generatedAt: new Date().toISOString(),
  };

  const hasSignal = inputs.business || inputs.notes || inputs.products.length > 0 || inputs.storeDomains.length > 0;
  if (!hasSignal) return fallback;

  try {
    const { json } = await callOpenAiJson({
      system: SYSTEM,
      user: JSON.stringify({
        nombre: inputs.name,
        giro: inputs.business,
        notas: inputs.notes,
        instagram: inputs.instagram,
        productos_de_campanas: inputs.products,
        nombres_de_anuncios: inputs.adNames,
        tiendas: inputs.storeDomains,
      }),
      maxTokens: 500,
    });
    const parsed = parseSeed({ ...json, sources: inputs.sources, generatedAt: fallback.generatedAt });
    if (!parsed) return fallback;
    return {
      ...parsed,
      products: parsed.products.length > 0 ? parsed.products : fallback.products,
    };
  } catch (error) {
    console.warn("[radar] seed_failed", { message: error instanceof Error ? error.message : "error" });
    return fallback;
  }
}
