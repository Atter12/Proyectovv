#!/usr/bin/env node
/**
 * Intercambia auth_code OAuth → access_token.
 *
 * Uso (pegá el código REAL de la URL, sin comillas):
 *   node --env-file=.env.local scripts/exchange-tiktok-auth-code.mjs d10f97adea76dee422879cdcd20d90d4f7d4a28b
 *
 * El token se guarda en tmp/tiktok-access-token.txt (no lo pegues en chats).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authCode = process.argv[2]?.trim();
const appId = process.env.TIKTOK_APP_ID?.trim() || process.env.TIKTOK_CLIENT_KEY?.trim();
const secret = process.env.TIKTOK_CLIENT_SECRET?.trim();
const base =
  process.env.TIKTOK_API_BASE_URL?.trim() ||
  "https://business-api.tiktok.com/open_api/v1.3";

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!authCode) {
  fail(
    "Falta el auth_code.\n\nEjemplo:\n  node --env-file=.env.local scripts/exchange-tiktok-auth-code.mjs d10f97adea76dee422879cdcd20d90d4f7d4a28b\n\nCopialo de la URL después de Confirm:\n  https://www.hecom.club/?auth_code=ESTE_ES_EL_CODIGO&...",
  );
  process.exit(1);
}

if (/TU_AUTH_CODE/i.test(authCode) || authCode.length < 20) {
  fail(
    `Eso no es un auth_code válido: "${authCode}"\n\nTenés que pegar el código largo de la URL (40 caracteres hex), no el texto de ejemplo.`,
  );
  process.exit(1);
}

if (!appId || !secret) {
  fail("Faltan TIKTOK_APP_ID y TIKTOK_CLIENT_SECRET en .env.local");
  process.exit(1);
}

console.log("Intercambiando auth_code con TikTok…");
console.log("App ID:", appId);
console.log("Auth code:", `${authCode.slice(0, 8)}…${authCode.slice(-4)} (${authCode.length} chars)`);

const res = await fetch(`${base}/oauth2/access_token/`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    app_id: appId,
    secret,
    auth_code: authCode,
  }),
});

const json = await res.json();

if (!json.data?.access_token) {
  console.error("\nError TikTok:", json.message ?? JSON.stringify(json));
  console.error("\nCausas comunes:");
  console.error("  1) Pegaste el texto de ejemplo, no el código de la URL");
  console.error("  2) El auth_code ya se usó (solo sirve 1 vez)");
  console.error("  3) Pasaron más de ~10 min — volvé a Confirm en TikTok");
  console.error("\nSolución: abrí de nuevo el link de autorización → Confirm → copiá auth_code NUEVO al instante.");
  process.exit(1);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "tmp");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "tiktok-access-token.txt");
writeFileSync(
  outFile,
  [
    `access_token=${json.data.access_token}`,
    `refresh_token=${json.data.refresh_token ?? ""}`,
    `expires_in=${json.data.expires_in ?? ""}`,
    `scope=${json.data.scope ?? ""}`,
  ].join("\n"),
  "utf8",
);

console.log("\n✓ Token guardado en:");
console.log(outFile);
console.log("\nAbrí ese archivo y copiá access_token a:");
console.log("  - .env.local → TIKTOK_ACCESS_TOKEN");
console.log("  - Vercel proyectovv + hecom.club");
console.log("\nVista previa:", `${String(json.data.access_token).slice(0, 8)}… (len ${String(json.data.access_token).length})`);
