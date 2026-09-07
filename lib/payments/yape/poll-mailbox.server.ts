import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { serverEnv } from "@/lib/env/env.server";
import { ingestYapeNotification } from "./match.server";

/**
 * Lectura de la casilla del banco desde la propia app.
 *
 * El agente de escritorio sirve para probar, pero en producción no puede
 * depender de que alguien deje una PC encendida: si se apaga, las recargas
 * dejan de acreditarse sin que nadie se entere. Esto corre como cron en el
 * mismo despliegue que la app.
 *
 * No guarda hasta dónde leyó. Cada corrida mira los últimos
 * YAPE_MAIL_LOOKBACK_MIN minutos y la deduplicación por huella descarta lo ya
 * procesado. Sin cursor no hay estado que se corrompa ni que restaurar, y si
 * el cron se saltea una corrida la siguiente igual alcanza los correos
 * pendientes mientras entren en la ventana.
 */

export interface MailboxPollResult {
  enabled: boolean;
  scanned: number;
  matched: number;
  unmatched: number;
  ignored: number;
  duplicates: number;
  skipped: number;
  errors: string[];
}

function isConfigured(): boolean {
  return Boolean(serverEnv.yapeMailUser && serverEnv.yapeMailPassword);
}

/** Cuerpo del correo como texto plano, conservando los saltos de línea. */
const HTML_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  deg: "°", ordm: "º", aacute: "á", eacute: "é", iacute: "í",
  oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É",
  Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", uuml: "ü",
  mdash: "—", ndash: "–", hellip: "…",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (match, name) => HTML_ENTITIES[name] ?? match);
}

/**
 * Convertimos el HTML nosotros en vez de usar el texto que genera mailparser:
 * cuando el correo no trae parte de texto, mailparser pega las celdas de las
 * tablas ("MontoS/ 187.43") y el monto deja de reconocerse. Los avisos del
 * banco son casi siempre tablas.
 */
function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|th|li|h[1-6]|table|span|b|strong)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(withBreaks)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function senderAllowed(fromText: string): boolean {
  const filters = serverEnv.yapeMailFromFilter;
  if (filters.length === 0) return true;
  const normalized = fromText.toLowerCase();
  return filters.some((allowed) => normalized.includes(allowed));
}

/**
 * Última vez que se abrió la casilla, para no golpear IMAP en cada consulta.
 *
 * Vive en memoria del proceso, así que con varias instancias en paralelo el
 * limite es por instancia y no global. Alcanza: el costo de una conexion de
 * mas es despreciable, y lo que queremos evitar es que el chat de un cliente
 * abra IMAP cada cuatro segundos durante diez minutos.
 */
let ultimaCorrida = 0;
const THROTTLE_MS = 12_000;

/**
 * Revisa la casilla solo si pasó el intervalo mínimo.
 *
 * La dispara el cliente que está esperando su recarga: sin esto tendría que
 * aguardar al cron, hasta dos minutos mirando "validando" con la plata ya
 * depositada. El cron queda como red por si cierra el navegador.
 */
export async function pollYapeMailboxThrottled(): Promise<
  MailboxPollResult | { skipped: true }
> {
  const ahora = Date.now();
  if (ahora - ultimaCorrida < THROTTLE_MS) return { skipped: true };
  ultimaCorrida = ahora;

  try {
    return await pollYapeMailbox();
  } catch (error) {
    // Nunca debe romper la consulta del cliente: si la casilla falla, el cron
    // reintenta y el cliente sigue viendo su estado.
    console.warn("[yape-mailbox] revision a demanda fallo", error);
    return { skipped: true };
  }
}

export async function pollYapeMailbox(): Promise<MailboxPollResult> {
  const result: MailboxPollResult = {
    enabled: false,
    scanned: 0,
    matched: 0,
    unmatched: 0,
    ignored: 0,
    duplicates: 0,
    skipped: 0,
    errors: [],
  };

  if (!isConfigured()) return result;
  result.enabled = true;

  const client = new ImapFlow({
    host: serverEnv.yapeMailHost,
    port: serverEnv.yapeMailPort,
    secure: true,
    auth: { user: serverEnv.yapeMailUser, pass: serverEnv.yapeMailPassword },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock(serverEnv.yapeMailMailbox);

  try {
    const since = new Date(
      Date.now() - serverEnv.yapeMailLookbackMinutes * 60_000,
    );

    for await (const message of client.fetch(
      { since },
      { uid: true, source: true, internalDate: true },
    )) {
      result.scanned += 1;

      try {
        if (!message.source) {
          result.skipped += 1;
          continue;
        }
        // Los tipos de mailparser declaran un overload con callback; sin el
        // cast, TypeScript resuelve la version que no devuelve el correo.
        const parsed = (await simpleParser(message.source)) as ParsedMail;
        const fromText = parsed.from?.text ?? "";

        if (!senderAllowed(fromText)) {
          result.skipped += 1;
          continue;
        }

        const body = parsed.html
          ? htmlToText(parsed.html)
          : (parsed.text?.trim() ?? "");
        const rawText = `${parsed.subject ?? ""}\n${body}`;

        const outcome = await ingestYapeNotification({
          source: "email",
          rawText,
          receivedAt: new Date(
            parsed.date ?? message.internalDate ?? Date.now(),
          ).toISOString(),
          metadata: {
            from: fromText,
            subject: parsed.subject ?? null,
            uid: message.uid,
          },
        });

        if (outcome.result === "matched") result.matched += 1;
        else if (outcome.result === "unmatched") result.unmatched += 1;
        else if (outcome.result === "ignored") result.ignored += 1;
        else if (outcome.result === "duplicate") result.duplicates += 1;
        else result.skipped += 1;
      } catch (error) {
        // Un correo raro no puede frenar el resto de la tanda.
        const message_ = error instanceof Error ? error.message : String(error);
        result.errors.push(message_.slice(0, 200));
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }

  return result;
}
