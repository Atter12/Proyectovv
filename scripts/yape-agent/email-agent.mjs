#!/usr/bin/env node
/**
 * Agente de correo para recargas Yape.
 *
 * Lee la casilla que recibe los avisos de cobro del banco, extrae monto,
 * N° de operación y remitente, y los reporta a /api/webhooks/yape/inbound.
 * Ese endpoint es el único que puede acreditar saldo con provider=yape.
 *
 * Modos:
 *   --inspect [n]   Muestra los últimos n correos y qué extrajo de cada uno.
 *                   NO reporta nada. Sirve para descubrir el remitente correcto
 *                   y verificar que el parser entiende el formato del banco.
 *   --dry-run       Corre el ciclo completo pero imprime en vez de reportar.
 *   (sin flags)     Vigila la casilla y reporta los cobros nuevos.
 *
 * Uso:
 *   node scripts/yape-agent/email-agent.mjs --inspect 20
 *   node scripts/yape-agent/email-agent.mjs --dry-run
 *   node scripts/yape-agent/email-agent.mjs
 *
 * Variables (ponelas en tu .env.local; este script nunca las imprime):
 *   YAPE_MAIL_USER          casilla, ej. avisos@tudominio.com
 *   YAPE_MAIL_PASSWORD      contraseña de aplicación (Gmail: NO la del correo)
 *   YAPE_MAIL_HOST          default imap.gmail.com
 *   YAPE_MAIL_PORT          default 993
 *   YAPE_MAIL_MAILBOX       default INBOX
 *   YAPE_MAIL_FROM_FILTER   remitentes válidos, separados por coma. Si está
 *                           vacío procesa todo correo que parezca un cobro.
 *   YAPE_MAIL_POLL_SECONDS  default 20
 *   YAPE_MAIL_LOOKBACK_MIN  default 30. En el primer arranque solo mira correos
 *                           de los últimos N minutos, para no reprocesar meses
 *                           de historial y acreditar pagos viejos.
 *   YAPE_AGENT_URL          default http://localhost:3000/api/webhooks/yape/inbound
 *   YAPE_INGEST_SECRET      el mismo del .env del servidor
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(HERE, ".state.json");

// --- Configuración ----------------------------------------------------------

const args = process.argv.slice(2);
const inspectMode = args.includes("--inspect");
const dryRun = args.includes("--dry-run");
const inspectCount = Number.parseInt(args[args.indexOf("--inspect") + 1], 10) || 15;

const config = {
  host: process.env.YAPE_MAIL_HOST ?? "imap.gmail.com",
  port: Number.parseInt(process.env.YAPE_MAIL_PORT ?? "993", 10),
  user: process.env.YAPE_MAIL_USER,
  password: process.env.YAPE_MAIL_PASSWORD,
  mailbox: process.env.YAPE_MAIL_MAILBOX ?? "INBOX",
  fromFilter: (process.env.YAPE_MAIL_FROM_FILTER ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
  pollSeconds: Number.parseInt(process.env.YAPE_MAIL_POLL_SECONDS ?? "20", 10),
  lookbackMinutes: Number.parseInt(process.env.YAPE_MAIL_LOOKBACK_MIN ?? "30", 10),
  agentUrl:
    process.env.YAPE_AGENT_URL ?? "http://localhost:3000/api/webhooks/yape/inbound",
  ingestSecret: process.env.YAPE_INGEST_SECRET,
  // Los preview de Vercel estan detras de SSO. Sin este token el POST del
  // agente se va a la pantalla de login en vez de llegar al endpoint.
  bypassToken: process.env.YAPE_AGENT_BYPASS_TOKEN ?? "",
};

function assertConfigured() {
  if (!config.user || !config.password) {
    console.error("Faltan YAPE_MAIL_USER y/o YAPE_MAIL_PASSWORD.");
    console.error("En Gmail necesitás verificación en dos pasos activa y una");
    console.error("contraseña de aplicación: https://myaccount.google.com/apppasswords");
    process.exit(1);
  }

  if (!inspectMode && !dryRun && !config.ingestSecret) {
    console.error("Falta YAPE_INGEST_SECRET (el mismo del .env del servidor).");
    process.exit(1);
  }
}

// --- Parser (SOLO para mostrar y para decidir si vale la pena reportar) ------
//
// La fuente de verdad es el parser del servidor
// (lib/payments/yape/parse-notification.ts). Acá NO extraemos el N° de
// operación para mandarlo: mantener dos parsers en sincronía ya falló una vez
// — este archivo capturaba "Fecha" de "Datos de la operación / Fecha y hora" y
// lo habría reportado como N° de operación, chocando con el índice UNIQUE y
// descartando el segundo pago real como duplicado.
//
// El agente solo decide "¿esto parece un cobro?" y le manda el texto crudo al
// servidor, que parsea una sola vez y de forma autoritativa.

const AMOUNT_PATTERNS = [
  /(?:S\/\.?|PEN|SOLES)\s*([0-9]{1,3}(?:[.,][0-9]{3})*|[0-9]+)[.,]([0-9]{2})\b/i,
  /\b([0-9]{1,3}(?:[.,][0-9]{3})*|[0-9]+)[.,]([0-9]{2})\s*(?:soles|PEN)\b/i,
];

const OPERATION_PATTERNS = [
  /(?:n(?:°|º|ro\.?|umero)?\s*(?:de\s*)?operaci[oó]n|c[oó]digo\s*de\s*operaci[oó]n|operaci[oó]n)\s*[:#]?\s*([A-Za-z0-9-]{4,64})/i,
  /(?:id\s*(?:de\s*la\s*)?transacci[oó]n)\s*[:#]?\s*([A-Za-z0-9-]{6,64})/i,
];

function extractAmountCents(text) {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const whole = match[1].replace(/[.,]/g, "");
    const parsed = Number.parseInt(`${whole}${match[2]}`, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/** Un N° de operación real es numérico; sin esto se cuelan palabras sueltas. */
function extractOperationNumber(text) {
  for (const pattern of OPERATION_PATTERNS) {
    const value = pattern.exec(text)?.[1]?.trim();
    if (value && /\d{4,}/.test(value)) return value;
  }
  return null;
}

/** Entidades que aparecen en los avisos de banco en español. */
const HTML_ENTITIES = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  deg: "°",
  ordm: "º",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
  uuml: "ü",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (match, name) => HTML_ENTITIES[name] ?? match);
}

/**
 * Cuerpo del correo como texto plano.
 *
 * Convertimos el HTML nosotros en vez de usar `parsed.text`, porque cuando el
 * correo no trae parte de texto mailparser lo genera solo y pega las celdas de
 * las tablas: "Monto" + "S/ 187.43" termina como "MontoS/ 187.43" y el regex
 * del monto ya no engancha. Los avisos de banco son casi siempre tablas.
 */
function htmlToText(html) {
  const withBreaks = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    // Cierre de celda o de bloque = salto de línea, para que no se peguen.
    .replace(/<\/(p|div|tr|td|th|li|h[1-6]|table|span|b|strong)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(withBreaks)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractBodyText(parsed) {
  const fromHtml = parsed.html ? htmlToText(parsed.html) : "";
  if (fromHtml) return fromHtml;

  return parsed.text?.trim() ?? "";
}

function senderMatchesFilter(fromText) {
  if (config.fromFilter.length === 0) return true;
  const normalized = (fromText ?? "").toLowerCase();
  return config.fromFilter.some((allowed) => normalized.includes(allowed));
}

// --- Estado local -----------------------------------------------------------
// Guardamos hasta dónde leímos para no re-reportar. El servidor igual deduplica
// por fingerprint y N° de operación, así que esto es la primera de dos redes.

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

// --- Reporte ----------------------------------------------------------------

async function report(payload) {
  const response = await fetch(config.agentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.ingestSecret}`,
      ...(config.bypassToken
        ? { "x-vercel-protection-bypass": config.bypassToken }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

// --- Conexión ---------------------------------------------------------------

function createClient() {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });
}

/**
 * Trae los mensajes a considerar en esta pasada.
 *
 * Primera corrida: solo los últimos N minutos, para no desenterrar historial.
 * Siguientes: todo lo que tenga UID mayor al último visto. Si cambia el
 * uidValidity de la casilla los UIDs se reinician, así que ahí volvemos a
 * arrancar por fecha.
 */
async function fetchNewMessages(client, state) {
  const status = await client.status(config.mailbox, { uidValidity: true });
  const uidValidity = String(status.uidValidity);
  const continuing = state && state.uidValidity === uidValidity && state.lastSeenUid;

  const query = continuing
    ? { uid: `${state.lastSeenUid + 1}:*` }
    : { since: new Date(Date.now() - config.lookbackMinutes * 60_000) };

  const messages = [];
  for await (const message of client.fetch(query, {
    uid: true,
    source: true,
    internalDate: true,
  })) {
    // Con `uid: "n:*"` IMAP siempre devuelve al menos el último mensaje aunque
    // sea más viejo que n, así que lo filtramos de nuevo acá.
    if (continuing && message.uid <= state.lastSeenUid) continue;
    messages.push(message);
  }

  return { messages, uidValidity };
}

async function processMessage(message, { announce }) {
  const parsed = await simpleParser(message.source);
  const fromText = parsed.from?.text ?? "";
  const subject = parsed.subject ?? "";
  const body = extractBodyText(parsed);
  const searchable = `${subject}\n${body}`;

  const amountCents = extractAmountCents(searchable);
  const operationNumber = extractOperationNumber(searchable);
  const passesFilter = senderMatchesFilter(fromText);

  if (announce) {
    console.log("─".repeat(70));
    console.log(`De:      ${fromText}`);
    console.log(`Asunto:  ${subject}`);
    console.log(`Fecha:   ${(parsed.date ?? message.internalDate)?.toISOString?.() ?? "?"}`);
    console.log(`Filtro:  ${passesFilter ? "pasa" : "DESCARTADO por YAPE_MAIL_FROM_FILTER"}`);
    console.log(
      `Monto:   ${amountCents === null ? "NO DETECTADO" : `S/ ${(amountCents / 100).toFixed(2)}`}`,
    );
    console.log(`Operac.: ${operationNumber ?? "no detectado"}`);
    console.log("Cuerpo (primeras 15 líneas):");
    for (const line of body.split("\n").slice(0, 15)) {
      console.log(`  | ${line}`);
    }
  }

  return {
    passesFilter,
    amountCents,
    operationNumber,
    payload: {
      source: "email",
      // Solo el texto crudo. El servidor extrae monto, remitente y N° de
      // operación: un único parser, una única verdad.
      rawText: searchable,
      receivedAt: (parsed.date ?? message.internalDate ?? new Date()).toISOString(),
      metadata: { from: fromText, subject, uid: message.uid },
    },
  };
}

// --- Modos ------------------------------------------------------------------

async function runInspect() {
  console.log(`\nInspeccionando los últimos ${inspectCount} correos de ${config.mailbox}.`);
  console.log("No se reporta ni acredita nada.\n");

  const client = createClient();
  await client.connect();
  const lock = await client.getMailboxLock(config.mailbox);

  try {
    const total = client.mailbox.exists;
    if (!total) {
      console.log("La casilla está vacía.");
      return;
    }
    const first = Math.max(1, total - inspectCount + 1);

    for await (const message of client.fetch(`${first}:${total}`, {
      uid: true,
      source: true,
      internalDate: true,
    })) {
      await processMessage(message, { announce: true });
    }

    console.log("─".repeat(70));
    console.log("\nQué mirar acá:");
    console.log("  · Si el correo del cobro muestra el monto detectado, ya funciona.");
    console.log("  · Copiá el 'De:' de ese correo a YAPE_MAIL_FROM_FILTER.");
    console.log("  · Si dice NO DETECTADO, pasame ese bloque y ajusto el parser.");
  } finally {
    lock.release();
    await client.logout();
  }
}

async function runOnce() {
  const client = createClient();
  await client.connect();
  const lock = await client.getMailboxLock(config.mailbox);

  try {
    const state = readState();
    const { messages, uidValidity } = await fetchNewMessages(client, state);

    let maxUid = state?.uidValidity === uidValidity ? (state.lastSeenUid ?? 0) : 0;

    for (const message of messages) {
      maxUid = Math.max(maxUid, message.uid);

      const result = await processMessage(message, { announce: false });

      if (!result.passesFilter) continue;
      if (result.amountCents === null) {
        // Un correo del banco que no trae monto no es un cobro (resumen,
        // promoción, alerta de login). Lo salteamos sin ruido.
        continue;
      }

      const amount = (result.amountCents / 100).toFixed(2);

      if (dryRun) {
        console.log(`[dry-run] S/ ${amount} · op ${result.operationNumber ?? "-"} · no reportado`);
        continue;
      }

      const { status, body } = await report(result.payload);
      const outcome = body.result ?? `HTTP ${status}`;
      const suffix =
        body.result === "matched"
          ? ` → acreditado (intent ${body.paymentIntentId})`
          : body.reason
            ? ` → ${body.reason}`
            : "";
      console.log(`[${new Date().toLocaleTimeString()}] S/ ${amount} · ${outcome}${suffix}`);
    }

    if (maxUid > 0) {
      writeState({ uidValidity, lastSeenUid: maxUid, updatedAt: new Date().toISOString() });
    }
  } finally {
    lock.release();
    await client.logout();
  }
}

async function runWatch() {
  console.log(`Vigilando ${config.user} en ${config.host}.`);
  console.log(`Reportando a ${config.agentUrl}`);
  console.log(
    config.fromFilter.length
      ? `Filtro de remitente: ${config.fromFilter.join(", ")}`
      : "Sin filtro de remitente: se procesa todo correo con un monto en soles.",
  );
  console.log(`Primera pasada: últimos ${config.lookbackMinutes} minutos.\n`);

  for (;;) {
    try {
      await runOnce();
    } catch (error) {
      // Caída de red, sesión expirada, casilla ocupada: no matamos el agente,
      // reintentamos en la próxima vuelta.
      console.error(`[${new Date().toLocaleTimeString()}] error: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollSeconds * 1000));
  }
}

// Los helpers de parseo se exportan para poder testearlos sin una casilla real.
export { extractAmountCents, extractOperationNumber, extractBodyText };

// Solo corre si se invoca directo; importarlo desde un test no arranca nada.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  assertConfigured();

  if (inspectMode) {
    await runInspect();
  } else if (dryRun) {
    console.log("Modo dry-run: se parsea pero no se reporta nada.\n");
    await runOnce();
  } else {
    await runWatch();
  }
}
