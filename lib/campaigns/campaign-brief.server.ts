import "server-only";
import { lookup } from "node:dns/promises";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { checkPublicUrl, isIpLiteral, isPrivateAddress } from "@/lib/campaigns/safe-url";
import {
  hasEnoughProductInfo,
  mergeProductInfo,
  parseProductPage,
  parseShopifyProduct,
  shopifyJsonUrl,
  type ProductInfo,
} from "@/lib/campaigns/product-page";
import {
  BRIEF_JSON_SCHEMA,
  buildBriefPrompt,
  normalizeBrief,
  suggestDailyBudget,
  type BudgetSuggestion,
  type CampaignBrief,
} from "@/lib/campaigns/campaign-brief";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const MAX_PAGE_BYTES = 2_500_000;
const MAX_IMAGE_BYTES = 6_000_000;
const OPENAI_TIMEOUT_MS = 40_000;
/** Ventana para el costo por venta del cliente. */
const CPR_WINDOW_DAYS = 30;
/** Algunas tiendas no responden a bots: se pide como un navegador. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export class BriefError extends Error {
  constructor(
    readonly code: "badUrl" | "unreachable" | "notProduct" | "ai" | "noKey",
    message: string,
  ) {
    super(message);
  }
}

/**
 * GET a un link pegado por el usuario, solo a internet público: valida el
 * link, resuelve el DNS y rechaza IPs internas en cada salto de redirección
 * (que no se pueda usar para leer la red interna ni la metadata de la nube).
 */
async function safeFetch(raw: string, opts: { maxBytes: number; accept: string }): Promise<{ url: string; body: Buffer; contentType: string }> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = checkPublicUrl(current);
    if (!check.ok) throw new BriefError("badUrl", `Link no permitido (${check.reason}).`);
    const host = check.url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIpLiteral(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
    if (addresses.length === 0) throw new BriefError("unreachable", "No se encontró la página.");
    if (addresses.some(isPrivateAddress)) throw new BriefError("badUrl", "Link no permitido (red interna).");

    const response = await fetch(check.url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: opts.accept, "Accept-Language": "es-PE,es;q=0.9" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    }).catch(() => {
      throw new BriefError("unreachable", "No se pudo abrir la página.");
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new BriefError("unreachable", "La página redirige a ningún lado.");
      current = new URL(location, check.url).toString();
      continue;
    }
    if (!response.ok || !response.body) throw new BriefError("unreachable", `La página respondió ${response.status}.`);

    const chunks: Buffer[] = [];
    let size = 0;
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > opts.maxBytes) {
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(Buffer.from(value));
    }
    return { url: check.url.toString(), body: Buffer.concat(chunks), contentType: response.headers.get("content-type") ?? "" };
  }
  throw new BriefError("unreachable", "Demasiadas redirecciones.");
}

function decodeHtml(body: Buffer, contentType: string): string {
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase();
  try {
    return new TextDecoder(charset === "iso-8859-1" || charset === "latin1" || charset === "windows-1252" ? "latin1" : "utf-8").decode(body);
  } catch {
    return body.toString("utf8");
  }
}

/** Ficha del producto desde su link (Shopify JSON si existe + la página). */
export async function readProduct(rawUrl: string): Promise<ProductInfo> {
  const page = await safeFetch(rawUrl, { maxBytes: MAX_PAGE_BYTES, accept: "text/html,application/xhtml+xml" });
  if (page.contentType && !/html|xml/i.test(page.contentType)) {
    throw new BriefError("notProduct", "El link no es una página web.");
  }
  const fromPage = parseProductPage(decodeHtml(page.body, page.contentType), page.url);
  const jsonUrl = shopifyJsonUrl(page.url);
  let fromShopify: Partial<ProductInfo> | null = null;
  if (jsonUrl) {
    fromShopify = await safeFetch(jsonUrl, { maxBytes: MAX_PAGE_BYTES, accept: "application/json" })
      .then((r) => parseShopifyProduct(JSON.parse(r.body.toString("utf8")), page.url))
      .catch(() => null);
  }
  const product = mergeProductInfo(fromShopify, fromPage);
  if (!hasEnoughProductInfo(product)) {
    throw new BriefError("notProduct", "No encontramos el producto en esa página. Pega el link de la página del producto.");
  }
  return product;
}

/** Foto del producto (para "Crear video"), por el mismo camino seguro. */
export async function fetchProductImage(rawUrl: string): Promise<{ body: Buffer; contentType: string }> {
  const r = await safeFetch(rawUrl, { maxBytes: MAX_IMAGE_BYTES, accept: "image/avif,image/webp,image/jpeg,image/png,*/*;q=0.5" });
  const contentType = r.contentType.split(";")[0].trim().toLowerCase();
  if (!/^image\/(jpeg|png|webp|avif)$/.test(contentType)) throw new BriefError("notProduct", "El link no es una foto.");
  if (r.body.length >= MAX_IMAGE_BYTES) throw new BriefError("notProduct", "La foto es muy pesada.");
  return { body: r.body, contentType };
}

/** Lo que le costó cada venta al cliente en los últimos días (radar), o null sin datos. */
export async function clienteCostPerResult(hecomClienteId: string): Promise<number | null> {
  const to = shiftYmd(todayYmdInTz("America/Lima"), -1);
  const from = shiftYmd(to, -(CPR_WINDOW_DAYS - 1));
  let spend = 0;
  let results = 0;
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const { data, error } = await createAdminClient()
      .from("radar_ad_daily")
      .select("spend, results")
      .eq("hecom_cliente_id", hecomClienteId)
      .gte("stat_date", from)
      .lte("stat_date", to)
      .range(offset, offset + 999);
    if (error || !data) return null;
    for (const row of data) {
      spend += Number(row.spend ?? 0);
      results += Number(row.results ?? 0);
    }
    if (data.length < 1000) break;
  }
  // Con muy pocas ventas el promedio engaña.
  return results >= 5 && spend > 0 ? spend / results : null;
}

/** Pide la propuesta a OpenAI con salida estructurada (JSON con esquema). */
async function askOpenAi(prompt: { system: string; user: string }): Promise<unknown> {
  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) throw new BriefError("noKey", "Falta la clave de OpenAI.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: serverEnv.openAiVisionModel,
      temperature: 0.8,
      response_format: { type: "json_schema", json_schema: BRIEF_JSON_SCHEMA },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    cache: "no-store",
  }).catch(() => {
    throw new BriefError("ai", "La IA no respondió a tiempo.");
  });
  const data = (await response.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string; refusal?: string } }[];
    error?: { message?: string };
  };
  if (!response.ok) throw new BriefError("ai", `OpenAI ${response.status}: ${data.error?.message?.slice(0, 160) ?? ""}`);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new BriefError("ai", data.choices?.[0]?.message?.refusal ? "La IA no quiso escribir sobre este producto." : "La IA no devolvió nada.");
  try {
    return JSON.parse(content);
  } catch {
    throw new BriefError("ai", "La IA devolvió algo ilegible.");
  }
}

export type BriefResult = { product: ProductInfo; brief: CampaignBrief; budget: BudgetSuggestion };

/** Link del producto → ficha + textos + guion + presupuesto sugerido. */
export async function generateCampaignBrief(input: {
  url: string;
  country: string;
  storeName: string | null;
  hecomClienteId: string | null;
}): Promise<BriefResult> {
  const [product, cpr] = await Promise.all([
    readProduct(input.url),
    input.hecomClienteId ? clienteCostPerResult(input.hecomClienteId).catch(() => null) : Promise.resolve(null),
  ]);
  const raw = await askOpenAi(buildBriefPrompt(product, { storeName: input.storeName, country: input.country }));
  const today = new Date()
    .toLocaleDateString("es-PE", { day: "2-digit", month: "short", timeZone: "America/Lima" })
    .replace(/\./g, "")
    .replace(/\s+/g, "-");
  const brief = normalizeBrief(raw, product, { country: input.country, today });
  if (!brief) throw new BriefError("ai", "La IA no devolvió textos útiles. Prueba de nuevo.");
  return { product, brief, budget: suggestDailyBudget(cpr) };
}
