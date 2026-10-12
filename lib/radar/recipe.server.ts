import "server-only";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
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
import type { VideoTags } from "@/lib/radar/tags";
import { scoreVideo, topPreferences } from "@/lib/radar/taste";
import { buildLivePool, readVideoToken } from "@/lib/radar/live-pool.server";

/**
 * Receta única del cliente (Fase 3). Junta lo que el cliente eligió, su perfil
 * y las referencias agregadas de su rubro, y pide a la IA patrones abstractos
 * más tres guiones propios. Cada guion pasa por el filtro anti-copia contra los
 * textos de los videos de referencia: si se parece demasiado se regenera una
 * vez y, si sigue igual, se descarta.
 */

export const RECIPE_PROMPT_VERSION = "radar-recipe-v2";
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

/**
 * Referencias de la receta. Primero lo que el cliente eligió en esta sesión
 * (videos firmados por el servidor); si no mandó nada —otra receta otro día—
 * se buscan en vivo videos del producto y se toman los que mejor encajan con
 * su gusto. Nada de esto se guarda.
 */
async function loadReferences(input: {
  profile: RadarProfile;
  product: string | null;
  picks: unknown[];
}): Promise<Reference[]> {
  const refs: Reference[] = [];
  for (const token of input.picks.slice(0, MAX_REFERENCES)) {
    const video = readVideoToken(token);
    if (!video || refs.some((r) => r.videoId === video.videoId)) continue;
    refs.push({ videoId: video.videoId, caption: video.caption, hashtags: video.hashtags, tags: video.tags, picked: true });
  }
  if (refs.length > 0 || !input.profile.categoryName) return refs;

  const live = await buildLivePool({
    category: input.profile.categoryName,
    products: input.product ? [input.product] : input.profile.products,
    maxQueries: 3,
    deadlineMs: Date.now() + 35_000,
  });
  return live.videos
    .map((v) => ({ v, score: scoreVideo(input.profile.taste, v.tags) }))
    .sort((a, b) => b.score - a.score || a.v.bestRank - b.v.bestRank)
    .slice(0, MAX_REFERENCES)
    .map(({ v }) => ({ videoId: v.videoId, caption: v.caption ?? "", hashtags: v.hashtags, tags: v.tags, picked: false }));
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

const SYSTEM = `Eres el guionista y estratega creativo de Ads Holistic. Escribes anuncios de TikTok que venden para pequeños negocios de Perú.

Principio que no se negocia: RECETA, NO COPIA.
- De los videos de referencia sacas solo patrones: tipo de gancho, formato, ritmo, estructura, estilo de texto en pantalla y de llamado a la acción.
- NUNCA repites frases, escenas concretas, nombres, marcas, productos, precios ni audios de esos videos. Todo se escribe desde cero para el producto del cliente.

Estándar de calidad (si no lo cumples, el guion no sirve):
- Cada guion es para UN solo producto: el que se indica en "producto".
- Usa los datos del producto que dé el cliente (precio, qué lo hace distinto, oferta, para quién es). Si no hay datos, escribe beneficios concretos y creíbles del tipo de producto y marca entre [corchetes] lo que el cliente debe completar, por ejemplo [precio] o [modelo]. Nunca inventes precios ni promociones.
- Duración, número de tramos y palabras habladas según "duracion_objetivo". Se habla a unas 2,5 palabras por segundo: un tramo de 10 s lleva unas 25 palabras de diálogo; si un tramo es solo imagen, dilo en "shot" y compensa en los demás. Cuenta las palabras: un guion con muy poco diálogo para su duración NO sirve. Los tramos van seguidos, sin saltos de tiempo, y cubren toda la duración. En videos largos el diálogo es más largo (3 a 5 frases por tramo), con desarrollo real: problema, demostración, prueba, objeciones con su respuesta, oferta y cierre.
- En cada tramo: "shot" dice exactamente qué se graba (plano, encuadre, acción, qué se muestra del producto) y "line" es el diálogo o la voz en off COMPLETO, palabra por palabra, listo para leer en voz alta (1 a 3 frases). Prohibido resumir ("presentamos el producto", "habla de los beneficios").
- "onScreen" es el texto que aparece en pantalla en ese tramo (corto). Vacío solo si no hace falta.
- Los primeros 3 segundos son el gancho: muestran el producto o el problema de inmediato. En videos largos, vuelve a enganchar cada 20 a 30 segundos (una pregunta, un dato, un cambio de plano).
- El llamado a la acción va de acuerdo con el objetivo: "messages" pide escribir por WhatsApp o mensaje directo; "sales" lleva a comprar en la tienda o la web; "followers" pide seguir la cuenta.
- Respeta quién puede salir en cámara. Si nadie puede, el guion usa solo el producto, las manos o texto.
- Respeta las reglas de publicidad del rubro que se indiquen.
- Español peruano neutro, trato de tú, frases cortas y habladas, sin emojis. TODO en español, incluidos "type", "format" y "whoAppears" (por ejemplo "Curiosidad", "Demostración", "Tú, el dueño"); nunca valores en inglés.
- Los 3 guiones deben ser distintos entre sí: otro gancho, otro formato y otro ángulo de venta.

Responde JSON con esta forma exacta:
{"recipe":{"summary":"una frase","hook":{"type":"","example":"","why":""},"format":"","durationSeconds":0,
"structure":[{"seconds":"0-3s","beat":""}],"onScreenText":[""],"cta":"","why":[""],"avoid":[""]},
"scripts":[{"title":"","hook":"la primera frase que se dice","hookAlternatives":["","",""],"whoAppears":"","durationSeconds":0,
"beats":[{"seconds":"0-3s","shot":"qué se ve","line":"qué se dice, completo","onScreen":"texto en pantalla"}],
"cta":"","caption":"texto de la publicación","hashtags":["",""],"tips":["cómo grabarlo con el celular"]}]}
Exactamente 3 guiones.`;

const WHO_CAN_APPEAR: Record<string, string> = {
  owner: "el dueño (tú)",
  team: "alguien del equipo",
  hire: "un creador contratado",
  nobody: "nadie: solo producto, manos o texto",
};

/** Duración que elige el cliente: los videos que funcionan en su rubro pueden durar minutos. */
export type RecipeLength = "short" | "medium" | "long";
export const RECIPE_LENGTHS: Record<RecipeLength, { seconds: string; beats: string; words: string; maxTokens: number }> = {
  // Palabras: unas 2,5 por segundo mientras se habla; los videos largos tienen tramos de demostración sin diálogo.
  short: { seconds: "30 a 40", beats: "6 a 8", words: "65 a 95", maxTokens: 7000 },
  medium: { seconds: "60 a 90", beats: "8 a 12", words: "120 a 190", maxTokens: 10000 },
  long: { seconds: "120 a 180", beats: "12 a 18", words: "220 a 340", maxTokens: 16000 },
};

/** Palabras habladas de un guion (lo que se dice en todos sus tramos). */
function spokenWords(script: RadarScript): number {
  return script.beats
    .map((b) => b.line)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function buildUserPrompt(input: {
  profile: RadarProfile;
  product: string | null;
  details: string | null;
  length: RecipeLength;
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
    datos_del_producto: input.details,
    duracion_objetivo: {
      segundos: RECIPE_LENGTHS[input.length].seconds,
      tramos: RECIPE_LENGTHS[input.length].beats,
      palabras_habladas_por_guion: RECIPE_LENGTHS[input.length].words,
    },
    quien_puede_salir: profile.canAppear.map((who) => WHO_CAN_APPEAR[who] ?? who),
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
  /** Videos elegidos en esta sesión, firmados por el servidor. */
  picks?: unknown[];
  /** Lo que el cliente cuenta de su producto: precio, qué lo hace distinto, oferta, para quién es. */
  details?: string | null;
  length?: RecipeLength;
}): Promise<StoredRecipe> {
  const profile = await getRadarProfile(input.hecomClienteId);
  if (!profile?.categoryName) throw new Error("Primero completa tu perfil del Radar.");

  const product = input.product?.trim() || profile.products[0] || null;
  const details = input.details?.trim().slice(0, 600) || null;
  const length: RecipeLength = input.length && input.length in RECIPE_LENGTHS ? input.length : "long";
  const references = await loadReferences({ profile, product, picks: input.picks ?? [] });
  if (references.length === 0) throw new Error("No encontré videos de referencia para tu producto. Intenta de nuevo en un momento.");
  const benchmark = await loadCategoryBenchmark(profile.categoryName).catch(() => null);
  const sources = references.map((r) => r.caption).filter(Boolean);

  let recipe: RadarRecipe | null = null;
  let scripts: RadarScript[] = [];
  let model = "";
  let feedback: string | undefined;
  const originality: Array<{ attempt: number; script: string; maxContainment: number; maxRun: number; ok: boolean }> = [];

  // Un guion que habla muy poco para su duración no sirve: se pide alargarlo (con 15 % de tolerancia).
  const minWords = Math.round(Number(RECIPE_LENGTHS[length].words.split(" ")[0]) * 0.85);
  const shortScripts: RadarScript[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await callOpenAiJson({
      system: SYSTEM,
      user: buildUserPrompt({ profile, product, details, length, references, benchmark, feedback }),
      model: serverEnv.radarRecipeModel,
      maxTokens: RECIPE_LENGTHS[length].maxTokens,
      temperature: 0.8,
      timeoutMs: length === "long" ? 140_000 : 90_000,
    });
    model = result.model;
    recipe = parseRecipe(result.json.recipe) ?? recipe;
    const candidates = parseScripts(result.json.scripts);

    const copied: string[] = [];
    const tooShort: string[] = [];
    for (const script of candidates) {
      const check = checkOriginality(scriptText(script), sources, ORIGINALITY_LIMITS);
      originality.push({ attempt, script: script.title, maxContainment: check.maxContainment, maxRun: check.maxRun, ok: check.ok });
      if (!check.ok) {
        copied.push(script.title);
      } else if (spokenWords(script) < minWords) {
        tooShort.push(`"${script.title}" (${spokenWords(script)} palabras)`);
        shortScripts.push(script);
      } else if (!scripts.some((s) => s.title === script.title)) {
        scripts.push(script);
      }
    }
    if (recipe && scripts.length >= 3) break;
    feedback =
      [
        copied.length
          ? `Los guiones "${copied.join('", "')}" repiten frases de los videos de referencia. Escríbelos desde cero.`
          : "",
        tooShort.length
          ? `Los guiones ${tooShort.join(", ")} hablan muy poco para su duración: cada uno necesita ${RECIPE_LENGTHS[length].words} palabras de diálogo. Escribe los 3 completos y más largos.`
          : "",
      ]
        .filter(Boolean)
        .join(" ") || "Faltaron guiones válidos. Devuelve exactamente 3, completos.";
  }

  // Si ni el segundo intento alcanzó el largo, mejor un guion algo corto que ninguno.
  for (const script of shortScripts.sort((a, b) => spokenWords(b) - spokenWords(a))) {
    if (scripts.length >= 3) break;
    if (!scripts.some((s) => s.title === script.title)) scripts.push(script);
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
      // Los videos de referencia no se guardan (se buscan en vivo).
      input_video_ids: [],
      profile_snapshot: {
        categoryName: profile.categoryName,
        products: profile.products,
        objective: profile.objective,
        canAppear: profile.canAppear,
        taste: profile.taste,
        benchmark,
        details,
        length,
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
