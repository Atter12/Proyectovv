/**
 * Clasifica la respuesta de https://www.tiktok.com/oembed (sin dependencias, para tests).
 *
 * Un video borrado, privado o con la inserción desactivada deja de responder:
 * se marca "dead" y el Radar lo reemplaza sin mostrar error. Un fallo
 * temporal (429, 5xx, red) es "unknown": se vuelve a revisar después.
 */

export type OembedAlive = {
  kind: "alive";
  title: string | null;
  authorName: string | null;
  authorUrl: string | null;
  thumbnailUrl: string | null;
};

export type OembedResult =
  | OembedAlive
  | { kind: "dead"; reason: string }
  | { kind: "unknown"; reason: string };

const DEAD_STATUSES = new Set([400, 403, 404, 410]);

function text(value: unknown): string | null {
  const s = value == null ? "" : String(value).trim();
  return s || null;
}

export function classifyOembed(status: number, body: unknown): OembedResult {
  if (DEAD_STATUSES.has(status)) return { kind: "dead", reason: `http_${status}` };
  if (status === 429 || status >= 500 || status === 0) {
    return { kind: "unknown", reason: `http_${status}` };
  }
  const json = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (status !== 200 || !json) return { kind: "unknown", reason: `http_${status}` };

  // TikTok a veces responde 200 con un código de error en el cuerpo.
  const code = Number(json.code ?? json.status_code ?? 0);
  if (Number.isFinite(code) && code >= 400) return { kind: "dead", reason: `code_${code}` };
  if (!text(json.html) && !text(json.embed_product_id) && !text(json.thumbnail_url)) {
    return { kind: "dead", reason: "sin_embed" };
  }

  return {
    kind: "alive",
    title: text(json.title),
    authorName: text(json.author_name),
    authorUrl: text(json.author_url),
    thumbnailUrl: text(json.thumbnail_url),
  };
}
