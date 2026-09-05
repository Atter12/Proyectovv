import { serverEnv } from "@/lib/env/env.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import {
  COD_PIXEL_EVENT_DEFS,
} from "@/lib/integrations/tiktok/pixel-events.shared";

export {
  COD_PIXEL_EVENT_DEFS,
  TIKTOK_BROWSER_TEST_EVENTS,
} from "@/lib/integrations/tiktok/pixel-events.shared";

interface TikTokApiResponse<T> {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
}

export class TikTokPixelApiError extends Error {
  readonly tiktokCode: number | null;
  readonly requestId: string | null;

  constructor(message: string, opts?: { code?: number | null; requestId?: string | null }) {
    super(message);
    this.name = "TikTokPixelApiError";
    this.tiktokCode = opts?.code ?? null;
    this.requestId = opts?.requestId ?? null;
  }
}

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function resolveAccessToken(organizationId?: string): Promise<string> {
  const { token } = await resolveTikTokFinanceAccessToken(organizationId);
  if (!token?.trim()) {
    throw new TikTokPixelApiError(
      "Falta TIKTOK_ACCESS_TOKEN (agencia) para operar píxeles.",
    );
  }
  return token.trim();
}

async function tiktokJson<T>(input: {
  path: string;
  method: "GET" | "POST";
  accessToken: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}): Promise<T> {
  const url = new URL(apiUrl(input.path));
  if (input.query) {
    for (const [k, v] of Object.entries(input.query)) {
      if (v != null && v !== "") url.searchParams.set(k, v);
    }
  }

  const response = await fetch(url.toString(), {
    method: input.method,
    headers: {
      "Access-Token": input.accessToken,
      Accept: "application/json",
      ...(input.method === "POST"
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: input.method === "POST" ? JSON.stringify(input.body ?? {}) : undefined,
    cache: "no-store",
  });

  let json: TikTokApiResponse<T>;
  try {
    json = (await response.json()) as TikTokApiResponse<T>;
  } catch {
    throw new TikTokPixelApiError(
      `TikTok pixel API: respuesta no JSON (HTTP ${response.status}).`,
    );
  }

  if (!response.ok || (json.code != null && json.code !== 0)) {
    const baseMsg =
      json.message ||
      `TikTok pixel API error (HTTP ${response.status}, code=${json.code ?? "?"}).`;
    const hint =
      json.code === 40001 || /permission/i.test(baseMsg)
        ? " Tip: si 'Ver píxeles' falla pero el token es nuevo, probá 'Crear píxel' (a veces TikTok deja crear/actualizar y no listar). Si crear también falla, en BC → Members → Manage permissions → Pixels."
        : "";
    throw new TikTokPixelApiError(`${baseMsg}${hint}`, {
      code: json.code ?? null,
      requestId: json.request_id ?? null,
    });
  }

  return (json.data ?? ({} as T)) as T;
}

export type TikTokPixelCategory =
  | "ONLINE_STORE"
  | "LEAD_GENERATION"
  | "CONTENT_AND_ENTERTAINMENT"
  | "OTHER";

export interface TikTokPixelRecord {
  pixelId: string;
  pixelCode: string | null;
  pixelName: string;
  pixelCategory: string | null;
  advertiserId: string;
  createTime: string | null;
  raw: Record<string, unknown>;
}

function mapPixelRow(
  row: Record<string, unknown>,
  advertiserId: string,
): TikTokPixelRecord {
  const pixelId = String(
    row.pixel_id ?? row.pixelId ?? row.id ?? "",
  ).trim();
  const pixelCode = String(
    row.pixel_code ?? row.pixelCode ?? row.code ?? "",
  ).trim();
  return {
    pixelId,
    pixelCode: pixelCode || null,
    pixelName: String(row.pixel_name ?? row.pixelName ?? row.name ?? "").trim(),
    pixelCategory: row.pixel_category
      ? String(row.pixel_category)
      : row.pixelCategory
        ? String(row.pixelCategory)
        : null,
    advertiserId,
    createTime: row.create_time
      ? String(row.create_time)
      : row.createTime
        ? String(row.createTime)
        : null,
    raw: row,
  };
}

export async function listTikTokPixels(input: {
  advertiserId: string;
  organizationId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ pixels: TikTokPixelRecord[]; pageInfo: Record<string, unknown> | null }> {
  const advertiserId = input.advertiserId.trim();
  if (!advertiserId) {
    throw new TikTokPixelApiError("advertiser_id requerido.");
  }
  const accessToken = await resolveAccessToken(input.organizationId);
  const data = await tiktokJson<{
    pixels?: Array<Record<string, unknown>>;
    list?: Array<Record<string, unknown>>;
    page_info?: Record<string, unknown>;
  }>({
    path: "/pixel/list/",
    method: "GET",
    accessToken,
    query: {
      advertiser_id: advertiserId,
      page: String(input.page ?? 1),
      page_size: String(input.pageSize ?? 20),
    },
  });

  const rows = data.pixels ?? data.list ?? [];
  return {
    pixels: rows
      .map((row) => mapPixelRow(row, advertiserId))
      .filter((p) => Boolean(p.pixelId)),
    pageInfo: data.page_info ?? null,
  };
}

export async function createTikTokPixel(input: {
  advertiserId: string;
  pixelName: string;
  pixelCategory?: TikTokPixelCategory;
  organizationId?: string;
  partnerName?: string;
}): Promise<TikTokPixelRecord> {
  const advertiserId = input.advertiserId.trim();
  const pixelName = input.pixelName.trim();
  if (!advertiserId) throw new TikTokPixelApiError("advertiser_id requerido.");
  if (!pixelName) throw new TikTokPixelApiError("pixel_name requerido.");

  const accessToken = await resolveAccessToken(input.organizationId);
  const data = await tiktokJson<Record<string, unknown>>({
    path: "/pixel/create/",
    method: "POST",
    accessToken,
    body: {
      advertiser_id: advertiserId,
      pixel_name: pixelName,
      pixel_category: input.pixelCategory ?? "ONLINE_STORE",
      ...(input.partnerName ? { partner_name: input.partnerName } : {}),
    },
  });

  const mapped = mapPixelRow(data, advertiserId);
  if (!mapped.pixelId) {
    // Algunas respuestas solo devuelven pixel_id en data raíz
    const fallbackId = String(
      data.pixel_id ?? data.pixelId ?? "",
    ).trim();
    if (!fallbackId) {
      throw new TikTokPixelApiError(
        "TikTok creó el píxel pero no devolvió pixel_id.",
        { requestId: null },
      );
    }
    return {
      ...mapped,
      pixelId: fallbackId,
      pixelCode:
        mapped.pixelCode ||
        String(data.pixel_code ?? data.code ?? "").trim() ||
        null,
      pixelName: mapped.pixelName || pixelName,
    };
  }
  return { ...mapped, pixelName: mapped.pixelName || pixelName };
}

export interface CreatePixelEventsResult {
  ok: true;
  applied: number;
  skipped: string[];
  raw: unknown;
}

/**
 * Registra eventos estándar. Usa rules URL CONTAINS "/" (siempre true en sitio)
 * porque TikTok Measurement suele exigir al menos una regla por evento.
 */
export async function createTikTokPixelEvents(input: {
  advertiserId: string;
  pixelId: string;
  organizationId?: string;
  /** Si se omite, usa plantilla COD. */
  events?: Array<{
    name: string;
    eventType: string;
    statisticType?: string;
  }>;
}): Promise<CreatePixelEventsResult> {
  const advertiserId = input.advertiserId.trim();
  const pixelId = input.pixelId.trim();
  if (!advertiserId || !pixelId) {
    throw new TikTokPixelApiError("advertiser_id y pixel_id requeridos.");
  }

  const defs =
    input.events && input.events.length > 0
      ? input.events
      : COD_PIXEL_EVENT_DEFS.map((d) => ({
          name: d.name,
          eventType: d.eventType,
          statisticType: d.statisticType,
        }));

  const pixelEvents = defs.map((d) => ({
    name: d.name,
    event_type: d.eventType,
    statistic_type: d.statisticType ?? "EVERY_TIME",
    currency_value: "-1",
    rules: [
      {
        variable: "URL",
        operator: "CONTAINS",
        values: ["/"],
      },
    ],
  }));

  const accessToken = await resolveAccessToken(input.organizationId);
  const skipped: string[] = [];
  let applied = 0;
  const rawParts: unknown[] = [];

  // TikTok a veces rechaza un lote entero por un event_type inválido:
  // intentamos lote completo y, si falla, uno por uno.
  try {
    const raw = await tiktokJson<unknown>({
      path: "/pixel/event/create/",
      method: "POST",
      accessToken,
      body: {
        advertiser_id: advertiserId,
        pixel_id: pixelId,
        pixel_events: pixelEvents,
      },
    });
    return { ok: true, applied: pixelEvents.length, skipped: [], raw };
  } catch (batchError) {
    rawParts.push({
      batchError:
        batchError instanceof Error ? batchError.message : String(batchError),
    });
  }

  for (const ev of pixelEvents) {
    try {
      const raw = await tiktokJson<unknown>({
        path: "/pixel/event/create/",
        method: "POST",
        accessToken,
        body: {
          advertiser_id: advertiserId,
          pixel_id: pixelId,
          pixel_events: [ev],
        },
      });
      applied += 1;
      rawParts.push({ event: ev.name, raw });
    } catch (error) {
      skipped.push(ev.name);
      rawParts.push({
        event: ev.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (applied === 0 && skipped.length > 0) {
    throw new TikTokPixelApiError(
      `No se pudo crear ningún evento: ${skipped.join(", ")}`,
    );
  }

  return { ok: true, applied, skipped, raw: rawParts };
}
