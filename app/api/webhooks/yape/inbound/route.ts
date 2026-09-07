import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import {
  ingestYapeNotification,
  type IngestYapeNotificationInput,
  type YapeNotificationSource,
} from "@/lib/payments/yape/match.server";

export const runtime = "nodejs";

const VALID_SOURCES: YapeNotificationSource[] = [
  "android_push",
  "email",
  "manual",
  "test",
];

/**
 * Ingesta de cobros Yape reales.
 *
 * Acá reporta el agente que corre fuera de la plataforma: el celular que lee
 * las notificaciones push, el parser del correo del banco o un admin cargando
 * a mano. Es el único camino que acredita saldo con provider=yape, así que el
 * secreto que lo protege es tan sensible como una llave de pasarela.
 */
function isAuthorized(request: Request): boolean {
  const expected = serverEnv.yapeIngestSecret;
  if (!expected) return false;

  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret = request.headers.get("x-yape-secret") ?? "";
  const provided = bearer || headerSecret;
  if (!provided) return false;

  // Comparación en tiempo constante: el secreto viaja desde un celular por
  // internet abierto y no queremos filtrarlo por temporización.
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let body: {
    source?: unknown;
    rawText?: unknown;
    text?: unknown;
    amountCents?: unknown;
    amount?: unknown;
    operationNumber?: unknown;
    senderName?: unknown;
    receivedAt?: unknown;
    metadata?: unknown;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const source = VALID_SOURCES.includes(body.source as YapeNotificationSource)
    ? (body.source as YapeNotificationSource)
    : "android_push";

  // `amount` llega en soles, `amountCents` en céntimos. El agente puede mandar
  // cualquiera de las dos, o ninguna y dejar que el parser lea el texto.
  const amountCents =
    typeof body.amountCents === "number"
      ? Math.round(body.amountCents)
      : typeof body.amount === "number"
        ? Math.round(body.amount * 100)
        : null;

  const input: IngestYapeNotificationInput = {
    source,
    rawText:
      typeof body.rawText === "string"
        ? body.rawText
        : typeof body.text === "string"
          ? body.text
          : null,
    amountCents,
    operationNumber:
      typeof body.operationNumber === "string" ? body.operationNumber : null,
    senderName: typeof body.senderName === "string" ? body.senderName : null,
    receivedAt: typeof body.receivedAt === "string" ? body.receivedAt : null,
    metadata:
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : undefined,
  };

  if (!input.rawText && input.amountCents === null) {
    return NextResponse.json(
      { error: "Se requiere rawText o amount/amountCents." },
      { status: 400 },
    );
  }

  try {
    const outcome = await ingestYapeNotification(input);

    // Un aviso sin cruzar no es un error del agente: se registró bien y queda
    // esperando revisión. Devolvemos 200 para que el agente no lo reintente en
    // loop y termine llenando la tabla de duplicados.
    return NextResponse.json({ ok: true, ...outcome });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo procesar el aviso.";
    console.error("[yape] ingest failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
