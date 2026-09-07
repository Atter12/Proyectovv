#!/usr/bin/env node
/**
 * Simula la llegada del correo del BCP avisando un yapeo recibido.
 *
 * Sirve para probar y demostrar el circuito completo SIN mover plata real y
 * sin depender de que el banco tenga el correo actualizado. El servidor no
 * distingue este aviso de uno real: entra por el mismo endpoint, con el mismo
 * secreto y el mismo texto.
 *
 * El cuerpo reproduce literalmente el correo real
 * "Constancia de recepción de Yapeo a celular BCP".
 *
 * Uso:
 *   node --env-file=.env.local scripts/yape-agent/simulate-bcp-email.mjs 114.85
 *   node --env-file=.env.local scripts/yape-agent/simulate-bcp-email.mjs 114.85 "Juan Perez Ramos"
 *
 * El monto tiene que ser EXACTAMENTE el que muestra el panel de recarga,
 * céntimos incluidos: son ellos los que identifican de quién es el pago.
 */

const [, , amountArg, senderArg] = process.argv;

const url =
  process.env.YAPE_AGENT_URL ?? "http://localhost:3000/api/webhooks/yape/inbound";
const secret = process.env.YAPE_INGEST_SECRET;

if (!secret) {
  console.error("Falta YAPE_INGEST_SECRET.");
  console.error("Corré con:  node --env-file=.env.local scripts/yape-agent/simulate-bcp-email.mjs <monto>");
  process.exit(1);
}

const amount = Number.parseFloat(String(amountArg ?? "").replace(",", "."));
if (!Number.isFinite(amount) || amount <= 0) {
  console.error("Monto inválido. Ejemplo:  ... simulate-bcp-email.mjs 114.85");
  process.exit(1);
}

const sender = senderArg || "Sebastian Jeremy Yparraguirre Ocaña";
const monto = amount.toFixed(2);
const ahora = new Date();

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const fechaLarga = `${ahora.getDate()} de ${MESES[ahora.getMonth()]} de ${ahora.getFullYear()}`;
const hora = ahora.toLocaleTimeString("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

// Texto calcado del correo real. Ojo: el BCP NO manda N° de operación, y por
// eso el monto con céntimos únicos es lo que identifica el pago.
const rawText = `Constancia de recepción de Yapeo a celular BCP - Servicio de Notificaciones BCP
Hola Renee Jessi,
Recibiste un yapeo de S/ ${monto} de ${sender}.
Por tu seguridad te enviamos los datos de tu yapeo.
Monto
Monto recibido
S/ ${monto}
Datos de la operación
Operación realizada
Yapeo a celular
Fecha y hora
${fechaLarga} - ${hora}
Enviado por
${sender}
¿No reconoces esta operación?
Comunícate inmediatamente con nosotros al (01) 311-9898 anexo *911 para ayudarte a verificarla.`;

console.log(`\nSimulando el correo del BCP: yapeo de S/ ${monto} de ${sender}\n`);

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify({
    source: "email",
    rawText,
    receivedAt: ahora.toISOString(),
    metadata: {
      from: "BCP Notificaciones <notificaciones@notificacionesbcp.com.pe>",
      subject: "Constancia de recepción de Yapeo a celular BCP",
      simulated: true,
    },
  }),
});

const body = await response.json().catch(() => ({}));
console.log(`HTTP ${response.status}`);
console.log(JSON.stringify(body, null, 2));

const mensajes = {
  matched: `\n✅ Cruzó con la recarga ${body.paymentIntentId}. Revisá el saldo en el panel.`,
  unmatched: `\n⚠️  Registrado, pero sin cruzar: ${body.reason ?? ""}\n   Revisá que el monto sea EXACTO al del panel y que la recarga siga abierta.`,
  duplicate: "\n↩️  Ese aviso ya se había procesado. No se acredita dos veces.",
  unparsable: `\n❌ No se pudo leer el aviso: ${body.reason ?? ""}`,
};

if (body.result && mensajes[body.result]) console.log(mensajes[body.result]);

process.exit(response.ok ? 0 : 1);
