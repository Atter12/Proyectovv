import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRadarCategory, type RadarCategory } from "@/lib/radar/categories";
import { guardRadarJob, RADAR_JOB_BUDGET_MS, radarJobError } from "@/lib/radar/job-route.server";
import { discoverFromWeb, type WebDiscoveryResult } from "@/lib/radar/web-discovery.server";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Búsqueda web nocturna del Radar: por cada rubro con clientes (y los rubros
 * por defecto), videos de TikTok con los productos de esos clientes. Se reparte
 * RADAR_WEB_QUERIES_PER_RUN entre todos. Las etiquetas las pone después el
 * proceso /tag.
 */
async function run(request: Request) {
  const deadlineMs = Date.now() + RADAR_JOB_BUDGET_MS;
  const { response } = guardRadarJob(request);
  if (response) return response;
  if (!serverEnv.serperApiKey) {
    return NextResponse.json({ ok: true, skipped: "SERPER_API_KEY no configurada." });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("radar_client_profiles")
      .select("category_name, products")
      .not("category_name", "is", null);
    if (error) throw new Error(`radar_client_profiles: ${error.message}`);

    // Rubro → productos de todos sus clientes (los rubros por defecto, sin productos).
    const byCategory = new Map<RadarCategory, string[]>();
    for (const category of serverEnv.radarDefaultCategories) {
      if (isRadarCategory(category)) byCategory.set(category, []);
    }
    for (const row of data ?? []) {
      const category = String(row.category_name ?? "").toUpperCase();
      if (!isRadarCategory(category)) continue;
      const products = (Array.isArray(row.products) ? row.products : [])
        .map((p: unknown) => String((typeof p === "string" ? p : (p as { name?: unknown })?.name) ?? "").trim())
        .filter(Boolean);
      byCategory.set(category, [...(byCategory.get(category) ?? []), ...products]);
    }

    const perCategory = Math.max(
      serverEnv.radarCountryCodes.length,
      Math.floor(serverEnv.radarWebQueriesPerRun / Math.max(1, byCategory.size)),
    );
    const results: Array<{ category: string } & WebDiscoveryResult> = [];
    for (const [category, products] of byCategory) {
      if (Date.now() > deadlineMs) break;
      const result = await discoverFromWeb({
        category,
        products,
        countries: serverEnv.radarCountryCodes,
        maxQueries: perCategory,
        deadlineMs,
      });
      results.push({ category, ...result });
      if (result.error) break;
    }
    return NextResponse.json({ ok: true, categories: results });
  } catch (error) {
    return radarJobError(error, "web");
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
