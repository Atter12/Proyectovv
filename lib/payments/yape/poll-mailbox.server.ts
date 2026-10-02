import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { dkimVerify } from "mailauth/lib/dkim/verify.js";
import { publicKeyResolver } from "@/lib/support/recharge-bot/bank-email.mjs";
import { serverEnv } from "@/lib/env/env.server";
import { ingestYapeNotification } from "./match.server";
import { ingestManualBankNotification } from "@/lib/payments/manual-bank-match/match.server";
import {
  looksLikeYapeNotification,
  parseManualBankNotificationText,
} from "@/lib/payments/manual-bank-match/parse-notification";

/**
 * Lectura de la casilla ops (BCP / Binance / Yape).
 *
 * - Avisos Yape → matcher del bot (Cobrana/chat).
 * - Transferencias BCP y recepciones Binance → matcher de pago manual del panel.
 *
 * No guarda hasta dónde leyó. Cada corrida mira los últimos
 * YAPE_MAIL_LOOKBACK_MIN minutos y la deduplicación por huella descarta lo ya
 * procesado.
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

/**
 * Compara contra la dirección real del remitente, no contra el texto visible:
 * "notificacionesbcp.com.pe <otro@gmail.com>" ya no pasa. Un filtro con "@"
 * exige ese buzón exacto; uno sin "@" exige ese dominio o un subdominio.
 */
function senderAllowed(fromAddress: string): boolean {
  const filters = [
    ...serverEnv.yapeMailFromFilter,
    ...serverEnv.manualMailFromFilter,
  ];
  if (filters.length === 0) return true;
  const address = fromAddress.trim().toLowerCase();
  const domain = address.split("@")[1] ?? "";
  if (!domain) return false;
  return filters.some((allowed) =>
    allowed.includes("@")
      ? address === allowed
      : domain === allowed || domain.endsWith(`.${allowed}`),
  );
}

/** Dominios que firman los avisos reales de BCP, Yape y Binance. */
const BANK_SIGNING_DOMAINS = [
  "bcp.com.pe",
  "viabcp.com",
  "notificacionesbcp.com.pe",
  "yape.com.pe",
  "binance.com",
];

function isBankDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return BANK_SIGNING_DOMAINS.some((bank) => d === bank || d.endsWith(`.${bank}`));
}

/**
 * El aviso cuenta como prueba de pago solo si lo firmó (DKIM) el dominio del
 * banco y esa firma coincide con el remitente. Sin esto, un correo desde
 * cualquier dominio con "viabcp.com" en el nombre visible pasaba el filtro.
 *
 * Por defecto descarta los que no pasan (quedan para revisión del gerente):
 * desde el 30/09/2026 todos los avisos reales del BCP pasaron la firma.
 * BANK_MAIL_DKIM_MODE=observe solo registra el resultado.
 */
async function verifyBankSignature(
  source: Buffer,
  fromAddress: string,
): Promise<{ pass: boolean; signingDomains: string[] }> {
  const fromDomain = fromAddress.split("@")[1]?.toLowerCase() ?? "";
  try {
    const auth = await dkimVerify(source, { resolver: publicKeyResolver });
    const passing = (auth.results ?? []).filter(
      (r: { status?: { result?: string } }) => r.status?.result === "pass",
    );
    const signingDomains = passing
      .map((r: { signingDomain?: string }) => String(r.signingDomain ?? "").toLowerCase())
      .filter(Boolean);
    const pass = signingDomains.some(
      (domain: string) =>
        isBankDomain(domain) && (fromDomain === domain || fromDomain.endsWith(`.${domain}`)),
    );
    return { pass, signingDomains };
  } catch (error) {
    console.warn("[yape-mailbox] dkim_check_failed", error);
    return { pass: false, signingDomains: [] };
  }
}

function bankDkimMode(): "observe" | "enforce" {
  return String(process.env.BANK_MAIL_DKIM_MODE ?? "").trim().toLowerCase() === "observe"
    ? "observe"
    : "enforce";
}

type MailRoute = "yape" | "manual_bank" | "skip";

function classifyMailRoute(rawText: string): MailRoute {
  if (looksLikeYapeNotification(rawText)) return "yape";

  const parsed = parseManualBankNotificationText(rawText);
  if (parsed.rail === "bcp_transfer" || parsed.rail === "binance") {
    return "manual_bank";
  }

  // Fallback: si el filtro de remitente ya lo dejó pasar y parece inbound
  // bancario genérico con monto, intentar manual (BCP a veces cambia el asunto).
  if (
    parsed.direction === "inbound" &&
    parsed.amountCents !== null &&
    parsed.currency !== null &&
    !looksLikeYapeNotification(rawText)
  ) {
    return "manual_bank";
  }

  return "skip";
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
    // Quien llama es una subida de voucher o el chat de recarga: no puede
    // esperar a la casilla más que unos segundos. Si no alcanza, sigue el cron.
    return await pollYapeMailbox({ deadlineMs: ON_DEMAND_DEADLINE_MS });
  } catch (error) {
    // Nunca debe romper la consulta del cliente: si la casilla falla, el cron
    // reintenta y el cliente sigue viendo su estado.
    console.warn("[yape-mailbox] revision a demanda fallo", error);
    return { skipped: true };
  }
}

/** Tope de la revisión a demanda (subida de voucher, chat de recarga). */
const ON_DEMAND_DEADLINE_MS = 10_000;

export async function pollYapeMailbox(options?: {
  /** Corta la corrida y cierra IMAP pasado este tiempo. */
  deadlineMs?: number;
  /** Pisa YAPE_MAIL_LOOKBACK_MIN, para ponerse al día tras una caída. */
  lookbackMinutes?: number;
}): Promise<MailboxPollResult> {
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
    // Desde el 01/10 la sesión se quedaba trabada en COMPRESS=DEFLATE.
    disableCompression: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });

  // Pasado el tope se cierra la conexión: lo que esté esperando a IMAP falla
  // y la corrida termina en vez de colgar la función hasta el timeout de Vercel.
  const deadline = options?.deadlineMs
    ? setTimeout(() => {
        result.errors.push(`Corte por tiempo (${options.deadlineMs} ms).`);
        client.close();
      }, options.deadlineMs)
    : null;

  try {
    await client.connect();
    const lock = await client.getMailboxLock(serverEnv.yapeMailMailbox);

    try {
      await scanMailbox(
        client,
        result,
        options?.lookbackMinutes ?? serverEnv.yapeMailLookbackMinutes,
      );
    } finally {
      lock.release();
      await client.logout().catch(() => undefined);
    }
  } finally {
    if (deadline) clearTimeout(deadline);
  }

  return result;
}

/**
 * SEARCH SINCE de IMAP solo mira el día, no la hora: sin más filtro se bajaba
 * cada correo del día completo (adjuntos incluidos) en cada corrida, y al
 * juntarse correos la corrida pasaba los 60 s. Primero se leen sobres, se
 * filtra por hora y remitente, y solo se baja el cuerpo de lo que queda.
 */
async function scanMailbox(
  client: ImapFlow,
  result: MailboxPollResult,
  lookbackMinutes: number,
): Promise<void> {
  const since = new Date(Date.now() - lookbackMinutes * 60_000);

  const uids: number[] = [];
  for await (const head of client.fetch(
    { since },
    { uid: true, envelope: true, internalDate: true },
  )) {
    const receivedAt = head.internalDate ? new Date(head.internalDate) : null;
    if (receivedAt && receivedAt < since) continue;
    const fromAddress = head.envelope?.from?.[0]?.address ?? "";
    if (!senderAllowed(fromAddress)) {
      result.scanned += 1;
      result.skipped += 1;
      continue;
    }
    uids.push(head.uid);
  }
  if (uids.length === 0) return;

  for await (const message of client.fetch(
    uids.join(","),
    { uid: true, source: true, internalDate: true },
    { uid: true },
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
      const fromAddress = parsed.from?.value?.[0]?.address ?? "";

      if (!senderAllowed(fromAddress)) {
        result.skipped += 1;
        continue;
      }

      const body = parsed.html
        ? htmlToText(parsed.html)
        : (parsed.text?.trim() ?? "");
      const rawText = `${parsed.subject ?? ""}\n${body}`;
      const receivedAt = new Date(
        parsed.date ?? message.internalDate ?? Date.now(),
      ).toISOString();
      const route = classifyMailRoute(rawText);
      if (route === "skip") {
        result.skipped += 1;
        continue;
      }

      const signature = await verifyBankSignature(message.source, fromAddress);
      const dkimMode = bankDkimMode();
      console.info("[yape-mailbox] dkim", {
        uid: message.uid,
        from: fromText,
        pass: signature.pass,
        signingDomains: signature.signingDomains,
        mode: dkimMode,
      });
      if (dkimMode === "enforce" && !signature.pass) {
        // Sin firma del banco no es prueba de pago: queda para el gerente.
        result.skipped += 1;
        continue;
      }

      const metadata = {
        from: fromText,
        subject: parsed.subject ?? null,
        uid: message.uid,
        dkim_pass: signature.pass,
        dkim_signing_domains: signature.signingDomains,
        dkim_mode: dkimMode,
      };

      const outcome =
        route === "yape"
          ? await ingestYapeNotification({
              source: "email",
              rawText,
              receivedAt,
              metadata,
            })
          : await ingestManualBankNotification({
              source: "email",
              rawText,
              receivedAt,
              metadata,
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
}
