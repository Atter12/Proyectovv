import "server-only";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { createAdminClient } from "@/lib/supabase/admin";
import { callOpenAiJson } from "@/lib/radar/openai.server";
import { getRadarProfile, type RadarProfile } from "@/lib/radar/profiles.server";
import { categoryBenchmark, type BenchmarkRow, type CategoryBenchmark } from "@/lib/radar/benchmarks";
import { checkOriginality, ORIGINALITY_LIMITS } from "@/lib/radar/originality";
import {
  parseRecipe,
  parseScripts,
  scriptText,
  type RadarRecipe,
  type RadarScript,
} from "@/lib/radar/recipe-parse";
import { normalizeTags, type VideoTags } from "@/lib/radar/tags";
import { topPreferences } from "@/lib/radar/taste";

/**
 * Receta única del cliente (Fase 3). Junta lo que el cliente eligió, su perfil
 * y las referencias agregadas de su rubro, y pide a la IA patrones abstractos
 * más tres guiones propios. Cada guion pasa por el filtro anti-copia contra los
 * textos de los videos de referencia: si se parece demasiado se regenera una
 * vez y, si sigue igual, se descarta.
 */

export const RECIPE_PROMPT_VERSION = "radar-recipe-v1";
const BENCH_DAYS = 14;
const MAX_REFERENCES = 8;

export type StoredRecipe = {
  id: string;
  product: string | null;
  recipe: RadarRecipe;
  scripts: RadarScript[];
  benchmark: CategoryBenchmark | null;
  createdAt: string;
};

type Reference = { videoId: string; caption: string; hashtags: string[]; tags: VideoTags; picked: boolean };

/** Rubros con reglas de publicidad estrictas en TikTok. */
const POLICY_NOTES: Record<string, string> = {
  HEALTH:
    "Salud y suplementos: no prometer curas, tratamientos ni resultados médicos; no decir que reemplaza medicinas; no usar antes y después de peso o del cuerpo; no mencionar enfermedades como algo que el producto quita.",
  BEAUTY_AND_PERSONAL_CARE:
    "Belleza: no prometer resultados garantizados ni cambios físicos exagerados; evitar antes y después engañosos.",
  FOOD_AND_BEVERAGE: "Comida y bebidas: no hacer afirmaciones de salud ni de pérdida de peso.",
};

async function loadReferences(hecomClienteId: string): Promise<Reference[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("radar_reactions")
    .select("video_id, reaction, round, created_at, radar_videos(caption, tags, status)")
    .eq("hecom_cliente_id", hecomClienteId)
    .in("reaction", ["pick", "like"])
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(`radar_reactions: ${error.message}`);

  const byId = new Map<string, Reference>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const video = (Array.isArray(row.radar_videos) ? row.radar_videos[0] : row.radar_videos) as
      | { caption?: string | null; tags?: unknown }
      | undefined;
    const videoId = String(row.video_id);
    const picked = row.reaction === "pick";
    const existing = byId.get(videoId);
    if (existing) {
      existing.picked ||= picked;
      continue;
    }
    byId.set(videoId, { videoId, caption: video?.caption ?? "", hashtags: [], tags: normalizeTags(video?.tags), picked });
  }

  // Lo elegido en la ronda reducida pesa más que lo que solo le gustó.
  const refs = [...byId.values()].sort((a, b) => Number(b.picked) - Number(a.picked)).slice(0, MAX_REFERENCES);
  if (refs.length > 0) {
    const { data: sources } = await admin
      .from("radar_video_sources")
      .select("video_id, hashtag_name")
      .in("video_id", refs.map((r) => r.videoId));
    for (const s of (sources ?? []) as Array<{ video_id: string; hashtag_name: string }>) {
      const ref = refs.find((r) => r.videoId === s.video_id);
      if (ref && !ref.hashtags.includes(s.hashtag_name)) ref.hashtags.push(s.hashtag_name);
    }
  }
  return refs;
}

async function loadCategoryBenchmark(categoryName: string): Promise<CategoryBenchmark | null> {
  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("radar_client_profiles")
    .select("hecom_cliente_id")
    .eq("category_name", categoryName);
  if (error) throw new Error(`radar_client_profiles: ${error.message}`);
  const clientes = (profiles ?? []).map((p) => String(p.hecom_cliente_id));
  if (clientes.length < 5) return null;

  const since = shiftYmd(todayYmdInTz("America/Lima"), -BENCH_DAYS);
  const rows: BenchmarkRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: rowsError } = await admin
      .from("radar_ad_daily")
      .select("advertiser_id, hecom_cliente_id, spend, results, impressions, clicks, video_play_actions, video_watched_6s")
      .in("hecom_cliente_id", clientes)
      .gte("stat_date", since)
      .range(from, from + 999);
    if (rowsError) throw new Error(`radar_ad_daily: ${rowsError.message}`);
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      rows.push({
        advertiserId: String(r.advertiser_id),
        hecomClienteId: (r.hecom_cliente_id as string | null) ?? null,
        spend: Number(r.spend ?? 0),
        results: r.results == null ? null : Number(r.results),
        impressions: r.impressions == null ? null : Number(r.impressions),
        clicks: r.clicks == null ? null : Number(r.clicks),
        videoPlayActions: r.video_play_actions == null ? null : Number(r.video_play_actions),
        videoWatched6s: r.video_watched_6s == null ? null : Number(r.video_watched_6s),
      });
    }
    if (!data || data.length < 1000) break;
  }
  return categoryBenchmark(rows);
}

const SYSTEM = `Eres el estratega creativo de Ads Holistic. Ayudas a vendedores pequeños de Perú a hacer anuncios de TikTok.
Principio que no se negocia: RECETA, NO COPIA.
- De los videos de referencia extraes solo patrones abstractos: tipo de gancho, formato, ritmo, estructura, estilo de texto en pantalla, tipo de llamado a la acción.
- NUNCA repites frases, escenas concretas, nombres, marcas, productos, precios ni audios de esos videos. Los guiones se escriben desde cero para el producto del cliente.
- Respeta quién puede salir en cámara: si nadie puede salir, el guion usa solo el producto, manos o texto.
- Respeta las reglas de publicidad del rubro que se indiquen.
- Español peruano neutro, trato de tú, frases cortas y habladas. Sin emojis.
Responde JSON con esta forma exacta:
{"recipe":{"summary":"una frase","hook":{"type":"","example":"","why":""},"format":"","durationSeconds":15,
"structure":[{"seconds":"0-3s","beat":""}],"onScreenText":[""],"cta":"","why":[""],"avoid":[""]},
"scripts":[{"title":"","hook":"","whoAppears":"","beats":[{"seconds":"0-3s","shot":"qué se ve","line":"qué se dice"}],"onScreenText":[""],"cta":""}]}
Exactamente 3 guiones distintos entre sí.`;

function buildUserPrompt(input: {
  profile: RadarProfile;
  product: string | null;
  references: Reference[];
  benchmark: CategoryBenchmark | null;
  feedback?: string;
}): string {
  const { profile } = input;
  const likes = topPreferences(profile.taste, 1).map((p) => `${p.dimension}=${p.value}`);
  return JSON.stringify({
    rubro: profile.categoryName,
    producto: input.product ?? profile.products[0] ?? null,
    otros_productos: profile.products,
    objetivo: profile.objective,
    quien_puede_salir: profile.canAppear,
    estilo_que_le_gusta: likes,
    reglas_del_rubro: profile.categoryName ? (POLICY_NOTES[profile.categoryName] ?? null) : null,
    referencia_de_costos_del_rubro: input.benchmark
      ? {
          cuentas: input.benchmark.accounts,
          costo_por_resultado_usd: input.benchmark.costPerResult,
          ctr_porcentaje: input.benchmark.ctr,
        }
      : null,
    videos_de_referencia: input.references.map((r) => ({
      elegido: r.picked,
      etiquetas: r.tags,
      texto: r.caption.slice(0, 300),
      hashtags: r.hashtags.slice(0, 5),
    })),
    ...(input.feedback ? { corrige_esto: input.feedback } : {}),
  });
}

export async function generateRadarRecipe(input: {
  hecomClienteId: string;
  product?: string | null;
}): Promise<StoredRecipe> {
  const profile = await getRadarProfile(input.hecomClienteId);
  if (!profile?.categoryName) throw new Error("Primero completa tu perfil del Radar.");

  const references = await loadReferences(input.hecomClienteId);
  if (references.length === 0) throw new Error("Elige al menos un video de referencia en el Radar.");
  const benchmark = await loadCategoryBenchmark(profile.categoryName).catch(() => null);
  const product = input.product?.trim() || profile.products[0] || null;
  const sources = references.map((r) => r.caption).filter(Boolean);

  let recipe: RadarRecipe | null = null;
  let scripts: RadarScript[] = [];
  let model = "";
  let feedback: string | undefined;
  const originality: Array<{ attempt: number; script: string; maxContainment: number; maxRun: number; ok: boolean }> = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await callOpenAiJson({
      system: SYSTEM,
      user: buildUserPrompt({ profile, product, references, benchmark, feedback }),
      maxTokens: 2200,
      temperature: 0.7,
      timeoutMs: 50_000,
    });
    model = result.model;
    recipe = parseRecipe(result.json.recipe) ?? recipe;
    const candidates = parseScripts(result.json.scripts);

    const copied: string[] = [];
    for (const script of candidates) {
      const check = checkOriginality(scriptText(script), sources, ORIGINALITY_LIMITS);
      originality.push({ attempt, script: script.title, maxContainment: check.maxContainment, maxRun: check.maxRun, ok: check.ok });
      if (check.ok) {
        if (!scripts.some((s) => s.title === script.title)) scripts.push(script);
      } else {
        copied.push(script.title);
      }
    }
    if (recipe && scripts.length >= 3) break;
    feedback = copied.length
      ? `Los guiones "${copied.join('", "')}" repiten frases de los videos de referencia. Escríbelos desde cero.`
      : "Faltaron guiones válidos. Devuelve exactamente 3, completos.";
  }

  if (!recipe || scripts.length === 0) {
    throw new Error("No pude armar una receta original esta vez. Intenta de nuevo en un momento.");
  }
  scripts = scripts.slice(0, 3);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("radar_recipes")
    .insert({
      hecom_cliente_id: input.hecomClienteId,
      product,
      input_video_ids: references.map((r) => r.videoId),
      profile_snapshot: {
        categoryName: profile.categoryName,
        products: profile.products,
        objective: profile.objective,
        canAppear: profile.canAppear,
        taste: profile.taste,
        benchmark,
      },
      recipe,
      scripts,
      originality: { limits: ORIGINALITY_LIMITS, checks: originality },
      model,
      prompt_version: RECIPE_PROMPT_VERSION,
    })
    .select("id, created_at")
    .single();
  if (error) throw new Error(`radar_recipes: ${error.message}`);

  return {
    id: String(data.id),
    product,
    recipe,
    scripts,
    benchmark,
    createdAt: String(data.created_at),
  };
}

export async function listRadarRecipes(hecomClienteId: string, limit = 5): Promise<StoredRecipe[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("radar_recipes")
    .select("id, product, recipe, scripts, profile_snapshot, created_at")
    .eq("hecom_cliente_id", hecomClienteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`radar_recipes: ${error.message}`);
  const out: StoredRecipe[] = [];
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const recipe = parseRecipe(row.recipe);
    if (!recipe) continue;
    const snapshot = (row.profile_snapshot ?? {}) as { benchmark?: CategoryBenchmark | null };
    out.push({
      id: String(row.id),
      product: (row.product as string | null) ?? null,
      recipe,
      scripts: parseScripts(row.scripts),
      benchmark: snapshot.benchmark ?? null,
      createdAt: String(row.created_at),
    });
  }
  return out;
}
