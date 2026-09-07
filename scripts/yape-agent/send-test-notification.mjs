#!/usr/bin/env node
/**
 * Simula un cobro Yape para probar la cadena completa sin mover plata real.
 *
 * Uso:
 *   node scripts/yape-agent/send-test-notification.mjs 187.43
 *   node scripts/yape-agent/send-test-notification.mjs 187.43 "Juan Perez" 987654321
 *
 * Variables:
 *   YAPE_AGENT_URL     default http://localhost:3000/api/webhooks/yape/inbound
 *   YAPE_INGEST_SECRET obligatorio, el mismo del .env del servidor
 *
 * El monto tiene que ser EXACTAMENTE el que muestra el chat, con sus céntimos:
 * son ellos los que identifican la recarga.
 */

const [, , amountArg, senderArg, operationArg] = process.argv;

const url =
  process.env.YAPE_AGENT_URL ?? "http://localhost:3000/api/webhooks/yape/inbound";
const secret = process.env.YAPE_INGEST_SECRET;

if (!secret) {
  console.error("Falta YAPE_INGEST_SECRET. Usa el mismo valor del .env del servidor.");
  process.exit(1);
}

const amount = Number.parseFloat(String(amountArg ?? "").replace(",", "."));
if (!Number.isFinite(amount) || amount <= 0) {
  console.error("Monto inválido. Ejemplo: node send-test-notification.mjs 187.43");
  process.exit(1);
}

const senderName = senderArg || "Cliente De Prueba";
// Sin N° de operación la deduplicación cae al hash por minuto, así que
// generamos uno para poder repetir la prueba las veces que haga falta.
const operationNumber = operationArg || `TEST${Date.now()}`;

const payload = {
  source: "test",
  amount,
  senderName,
  operationNumber,
  receivedAt: new Date().toISOString(),
  rawText: `Yape! ${senderName} te envió un pago por S/ ${amount.toFixed(2)}`,
  metadata: { simulated: true },
};

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify(payload),
});

const body = await response.json().catch(() => ({}));

console.log(`HTTP ${response.status}`);
console.log(JSON.stringify(body, null, 2));

if (body.result === "matched") {
  console.log(`\n✅ Cruzó con la recarga ${body.paymentIntentId}. Saldo acreditado.`);
} else if (body.result === "unmatched") {
  console.log(`\n⚠️  Registrado pero sin cruzar: ${body.reason}`);
  console.log("   Revisa que el monto sea exacto y que la recarga siga abierta.");
} else if (body.result === "duplicate") {
  console.log("\n↩️  Ya se había procesado ese cobro. No se acreditó de nuevo.");
}

process.exit(response.ok ? 0 : 1);
