/**
 * Validación de la receta que devuelve la IA (sin dependencias, para tests).
 * Todo lo que no cumpla la forma se descarta: la interfaz nunca recibe campos
 * sueltos ni HTML.
 */

export type RecipeBeat = { seconds: string; beat: string };

export type RadarRecipe = {
  summary: string;
  hook: { type: string; example: string; why: string };
  format: string;
  durationSeconds: number | null;
  structure: RecipeBeat[];
  onScreenText: string[];
  cta: string;
  why: string[];
  avoid: string[];
};

/** Un tramo del guion: qué se ve, qué se dice palabra por palabra y el texto en pantalla de ese momento. */
export type ScriptBeat = { seconds: string; shot: string; line: string; onScreen: string };

export type RadarScript = {
  title: string;
  hook: string;
  /** Otras formas de abrir el mismo video, para probar. */
  hookAlternatives: string[];
  whoAppears: string;
  durationSeconds: number | null;
  beats: ScriptBeat[];
  onScreenText: string[];
  cta: string;
  /** Texto de la publicación y hashtags. */
  caption: string;
  hashtags: string[];
  /** Cómo grabarlo con el celular. */
  tips: string[];
};

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(value: unknown, max = 400): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function strList(value: unknown, maxItems = 8, maxLen = 200): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => str(v, maxLen)).filter(Boolean).slice(0, maxItems);
}

function seconds(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}s`;
  return str(value, 20);
}

export function parseRecipe(raw: unknown): RadarRecipe | null {
  const r = rec(raw);
  const hook = rec(r.hook);
  const recipe: RadarRecipe = {
    summary: str(r.summary, 500),
    hook: { type: str(hook.type, 80), example: str(hook.example, 200), why: str(hook.why, 300) },
    format: str(r.format, 120),
    durationSeconds: (() => {
      const n = Number(r.durationSeconds ?? r.duration_seconds);
      return Number.isFinite(n) && n > 0 && n <= 300 ? Math.round(n) : null;
    })(),
    structure: (Array.isArray(r.structure) ? r.structure : [])
      .map((b) => ({ seconds: seconds(rec(b).seconds), beat: str(rec(b).beat, 200) }))
      .filter((b) => b.beat)
      .slice(0, 12),
    onScreenText: strList(r.onScreenText ?? r.on_screen_text, 6, 120),
    cta: str(r.cta, 160),
    why: strList(r.why, 6, 260),
    avoid: strList(r.avoid, 6, 200),
  };
  if (!recipe.summary || !recipe.hook.example || recipe.structure.length === 0) return null;
  return recipe;
}

export function parseScripts(raw: unknown): RadarScript[] {
  if (!Array.isArray(raw)) return [];
  const out: RadarScript[] = [];
  for (const item of raw) {
    const s = rec(item);
    const script: RadarScript = {
      title: str(s.title, 100),
      hook: str(s.hook, 220),
      hookAlternatives: strList(s.hookAlternatives ?? s.hook_alternatives, 3, 220),
      whoAppears: str(s.whoAppears ?? s.who_appears, 120),
      durationSeconds: (() => {
        const n = Number(s.durationSeconds ?? s.duration_seconds);
        return Number.isFinite(n) && n > 0 && n <= 300 ? Math.round(n) : null;
      })(),
      beats: (Array.isArray(s.beats) ? s.beats : [])
        .map((b) => ({
          seconds: seconds(rec(b).seconds),
          shot: str(rec(b).shot, 300),
          line: str(rec(b).line, 600),
          onScreen: str(rec(b).onScreen ?? rec(b).on_screen, 120),
        }))
        .filter((b) => b.shot || b.line)
        .slice(0, 20),
      onScreenText: strList(s.onScreenText ?? s.on_screen_text, 6, 120),
      cta: str(s.cta, 200),
      caption: str(s.caption, 500),
      hashtags: strList(s.hashtags, 8, 40).map((h) => (h.startsWith("#") ? h : `#${h}`)),
      tips: strList(s.tips, 5, 200),
    };
    if (script.title && script.hook && script.beats.length > 0) out.push(script);
    if (out.length >= 3) break;
  }
  return out;
}

/** Todo el texto de un guion, para pasarlo por el filtro anti-copia. */
export function scriptText(script: RadarScript): string {
  return [
    script.hook,
    ...script.hookAlternatives,
    ...script.beats.flatMap((b) => [b.line, b.onScreen]),
    ...script.onScreenText,
    script.cta,
    script.caption,
  ].join(" ");
}
