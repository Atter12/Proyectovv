import { createHash } from "node:crypto";

/**
 * Parser tolerante para avisos de cobro Yape / Plin.
 *
 * El agente puede mandar los campos ya estructurados (lo ideal) o el texto
 * crudo del push / correo. Acá cubrimos el segundo caso, que es el que llega
 * desde un notification listener de Android sin lógica propia.
 *
 * Formatos vistos en producción:
 *   "Yape! Juan Pérez te envió un pago por S/ 50.00"
 *   "Confirmación de Yapeo: Recibiste S/20.00 de JUAN P."
 *   "PEN 5.00 — Enviado por Sebastian Yparraguirre — N° de operación 2026090514264909"
 *   "Constancia de transferencia. Monto: S/ 187,43. Nro. de operación: 12345678"
 */
export interface ParsedYapeNotification {
  amountCents: number | null;
  operationNumber: string | null;
  senderName: string | null;
}

/**
 * Monto en soles. Acepta `S/`, `S/.`, `PEN` y coma o punto como separador
 * decimal. Exigimos los dos decimales porque el discriminador de céntimos es
 * justamente lo que identifica el pago: un aviso sin decimales no sirve para
 * cruzar y es mejor que caiga a revisión manual.
 */
const AMOUNT_PATTERNS: RegExp[] = [
  /(?:S\/\.?|PEN|SOLES)\s*([0-9]{1,3}(?:[.,][0-9]{3})*|[0-9]+)[.,]([0-9]{2})\b/i,
  /\b([0-9]{1,3}(?:[.,][0-9]{3})*|[0-9]+)[.,]([0-9]{2})\s*(?:soles|PEN)\b/i,
];

const OPERATION_PATTERNS: RegExp[] = [
  /(?:n(?:°|º|ro\.?|umero)?\s*(?:de\s*)?operaci[oó]n|c[oó]digo\s*de\s*operaci[oó]n|operaci[oó]n)\s*[:#]?\s*([A-Za-z0-9-]{4,64})/i,
  /(?:id\s*(?:de\s*la\s*)?transacci[oó]n)\s*[:#]?\s*([A-Za-z0-9-]{6,64})/i,
];

const SENDER_PATTERNS: RegExp[] = [
  // BCP: "Enviado por  Sebastian Jeremy Yparraguirre Ocaña"
  /(?:enviado\s+por)\s*[:]?\s*([A-Za-zÁÉÍÓÚÑáéíóúñ.\s]{3,60})/i,
  // BCP: "Recibiste un yapeo de S/ 9.00 de Sebastian Jeremy Yparraguirre Ocaña."
  /recibiste\s+un\s+yapeo\s+de\s+(?:S\/\.?\s*)?[0-9.,]+\s+de\s+([A-Za-zÁÉÍÓÚÑáéíóúñ.\s]{3,60})/i,
  /^\s*(?:yape!?\s*)?([A-Za-zÁÉÍÓÚÑáéíóúñ.\s]{3,60}?)\s+te\s+(?:envi[oó]|yape[oó])/i,
  /(?:recibiste|te\s+yape[oó]|te\s+envi[oó]).{0,40}?\bde\s+([A-Za-zÁÉÍÓÚÑáéíóúñ.\s]{3,60})/i,
];

/**
 * ¿El aviso dice que ENTRÓ plata, o que SALIÓ?
 *
 * El filtro por remitente no alcanza: el banco manda por el mismo remitente los
 * cobros recibidos y los consumos con tarjeta. En la casilla de prueba
 * convivían "Constancia de recepción de Yapeo" (entra) con "Realizaste un
 * consumo de S/ 395.00 con tu Tarjeta de Débito BCP" (sale).
 *
 * Sin este control, una compra en una tienda por un monto que coincidiera con
 * una recarga abierta le habría acreditado saldo a un cliente. Plata que salió
 * de la cuenta, contada como plata que entró.
 */
export type NotificationDirection = "inbound" | "outbound" | "unknown";

/** Plata que sale. Si aparece cualquiera de estas, el aviso se descarta. */
const OUTBOUND_PATTERNS: RegExp[] = [
  // Verificado contra el correo real del BCP: el aviso de un yapeo ENVIADO
  // dice "Realizaste un yapeo a celular" y "Monto enviado", y llega por el
  // mismo remitente y con el mismo monto que el de un cobro recibido. Antes
  // caia en "desconocido" y se descartaba de casualidad; si el cuerpo hubiera
  // dicho "Monto recibido" en algun pie, habria acreditado plata propia.
  /realizaste\s+un\s+yape/i,
  /monto\s+enviado/i,
  /realizaste\s+un\s+consumo/i,
  /realizaste\s+una\s+(?:transferencia|compra|operaci[oó]n\s+de\s+pago)/i,
  /total\s+del\s+consumo/i,
  /\byapeaste\b/i,
  /\benviaste\b/i,
  /tu\s+recarga\s+en\s+yape/i,
  /pago\s+de\s+servicio/i,
  /retiro\s+sin\s+tarjeta/i,
  /\bcargo\s+en\s+tu\s+cuenta/i,
];

/** Plata que entra. Hace falta al menos una para aceptar el aviso. */
const INBOUND_PATTERNS: RegExp[] = [
  /recibiste\s+un\s+yape/i,
  /constancia\s+de\s+recepci[oó]n/i,
  /monto\s+recibido/i,
  /te\s+(?:envi[oó]|yape[oó])\b/i,
  /\brecibiste\b/i,
  /abono\s+en\s+tu\s+cuenta/i,
];

export function classifyDirection(text: string): NotificationDirection {
  // Primero lo saliente: ante un texto ambiguo preferimos NO acreditar.
  if (OUTBOUND_PATTERNS.some((pattern) => pattern.test(text))) return "outbound";
  if (INBOUND_PATTERNS.some((pattern) => pattern.test(text))) return "inbound";
  return "unknown";
}

export function parseYapeNotificationText(text: string): ParsedYapeNotification {
  const normalized = text.replace(/\s+/g, " ").trim();

  return {
    amountCents: extractAmountCents(normalized),
    operationNumber: extractOperationNumber(normalized),
    senderName: extractSenderName(normalized),
  };
}

function extractAmountCents(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    // Los separadores de millar se descartan; solo nos importa el entero y los
    // dos decimales capturados por separado.
    const whole = match[1].replace(/[.,]/g, "");
    const cents = match[2];
    const parsed = Number.parseInt(`${whole}${cents}`, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/**
 * Un N° de operación real es numérico.
 *
 * Sin esta validación el regex se come palabras sueltas del cuerpo: en el
 * correo del BCP, "Datos de la operación / Operación realizada" hacía que
 * capturara "Operaci". Y como la columna es UNIQUE, el segundo correo habría
 * parseado exactamente lo mismo, chocado con el índice y sido descartado como
 * duplicado — o sea, el segundo pago real jamás se acreditaba.
 */
function looksLikeOperationNumber(value: string): boolean {
  return /\d{4,}/.test(value);
}

function extractOperationNumber(text: string): string | null {
  for (const pattern of OPERATION_PATTERNS) {
    const value = pattern.exec(text)?.[1]?.trim();
    if (value && looksLikeOperationNumber(value)) return value;
  }
  return null;
}

/**
 * Palabras que suelen quedar pegadas al final del nombre porque el separador
 * real es un símbolo que la clase de caracteres del regex no puede consumir
 * (el "N" de "N° de operación", por ejemplo).
 *
 * Una inicial con punto ("JUAN P.") no entra acá: el punto la distingue.
 */
const SENDER_TRAILING_NOISE = new Set([
  "n",
  "nro",
  "no",
  "numero",
  "num",
  "operacion",
  "codigo",
  "id",
  "monto",
  "importe",
  "fecha",
  "hora",
  "hs",
  "por",
  "el",
  "la",
  "un",
  "una",
  "de",
  "del",
]);

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extractSenderName(text: string): string | null {
  for (const pattern of SENDER_PATTERNS) {
    const match = pattern.exec(text);
    // Cortamos en el punto que cierra la oracion: el nombre viene seguido de
    // ". Por tu seguridad te enviamos..." y la clase de caracteres, que acepta
    // letras, espacios y puntos, se lo comia entero.
    const value = match?.[1]?.replace(/\s+/g, " ").split(/\.\s/)[0]?.trim();
    if (!value) continue;

    const words = value.split(" ").filter(Boolean);
    while (
      words.length > 0 &&
      SENDER_TRAILING_NOISE.has(stripDiacritics(words[words.length - 1]).toLowerCase())
    ) {
      words.pop();
    }

    const cleaned = words.join(" ");
    // Un nombre real tiene al menos 3 caracteres. Menos que eso es basura del
    // parser, no una persona.
    if (cleaned.length >= 3) return cleaned;
  }
  return null;
}

/**
 * Clave de deduplicación de un aviso.
 *
 * Con N° de operación es determinista y perfecta. Sin él, colapsamos por
 * fuente + monto + minuto de recepción: si el mismo push se reenvía dos veces
 * cae en el mismo bucket y la unicidad de la tabla lo rechaza, pero dos pagos
 * distintos del mismo monto en el mismo minuto siguen siendo filas distintas
 * porque el discriminador de céntimos los separa.
 */
export function buildFingerprint(input: {
  source: string;
  operationNumber: string | null;
  amountCents: number;
  senderName: string | null;
  receivedAt: string;
  rawText: string | null;
}): string {
  if (input.operationNumber) {
    return `op:${input.operationNumber.toLowerCase()}`;
  }

  // Al segundo, no al minuto: el correo del BCP no trae N° de operación, así
  // que dos cobros iguales del mismo remitente en el mismo minuto colapsarían
  // en la misma huella y el segundo se perdería como falso duplicado. El mismo
  // correo reprocesado sí mantiene su fecha exacta, que es lo que queremos
  // deduplicar.
  const secondBucket = input.receivedAt.slice(0, 19); // YYYY-MM-DDTHH:mm:ss
  const payload = [
    input.source,
    String(input.amountCents),
    (input.senderName ?? "").toLowerCase(),
    secondBucket,
    input.rawText ?? "",
  ].join("|");

  return `h:${createHash("sha256").update(payload).digest("hex").slice(0, 40)}`;
}
