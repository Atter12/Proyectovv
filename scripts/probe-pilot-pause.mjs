/**
 * Prueba de la acción del Piloto (pausar / reactivar un anuncio) en una cuenta de PRUEBA,
 * antes de encender PILOT_ACTIONS_ENABLED.
 *
 * Por defecto NO cambia nada: solo muestra el estado del anuncio.
 *
 *   node --use-system-ca --env-file=.env.local scripts/probe-pilot-pause.mjs --advertiser=<id> --ad=<ad_id>
 *   node --use-system-ca --env-file=.env.local scripts/probe-pilot-pause.mjs --advertiser=<id> --ad=<ad_id> --confirm          # pausa
 *   node --use-system-ca --env-file=.env.local scripts/probe-pilot-pause.mjs --advertiser=<id> --ad=<ad_id> --confirm --enable # reactiva
 *
 * Es la misma llamada que hace el Piloto: POST /ad/status/update/ con DISABLE (o ENABLE).
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : "true"];
  }),
);

const token = (process.env.TIKTOK_ACCESS_TOKEN ?? "").trim();
const base = (process.env.TIKTOK_API_BASE_URL ?? "https://business-api.tiktok.com/open_api/v1.3").replace(/\/$/, "");
const advertiserId = String(args.advertiser ?? "").trim();
const adId = String(args.ad ?? "").trim();

if (!token) {
  console.error("Falta TIKTOK_ACCESS_TOKEN. Corre el script con --env-file=.env.local.");
  process.exit(1);
}
if (!advertiserId || !adId) {
  console.error("Uso: --advertiser=<advertiser_id> --ad=<ad_id> [--confirm] [--enable]");
  process.exit(1);
}

async function call(path, { method = "GET", query, body } = {}) {
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  const res = await fetch(url, {
    method,
    headers: { "Access-Token": token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  return res.json().catch(() => ({}));
}

async function showStatus(label) {
  const json = await call("/ad/get/", {
    query: {
      advertiser_id: advertiserId,
      filtering: { ad_ids: [adId] },
      fields: ["ad_id", "ad_name", "operation_status", "secondary_status", "adgroup_id"],
    },
  });
  if (json.code !== 0) {
    console.log(`${label}: ad/get falló code=${json.code} ${json.message ?? ""}`);
    return;
  }
  const ad = json.data?.list?.[0];
  console.log(
    ad
      ? `${label}: «${ad.ad_name}» operation_status=${ad.operation_status} secondary_status=${ad.secondary_status} grupo=${ad.adgroup_id}`
      : `${label}: no se encontró el anuncio (¿es Smart+? esos se pausan por material).`,
  );
}

await showStatus("Antes");

if (args.confirm !== "true") {
  console.log("\nNo se cambió nada. Agrega --confirm para pausar (o --confirm --enable para reactivar).");
  process.exit(0);
}

const status = args.enable === "true" ? "ENABLE" : "DISABLE";
const result = await call("/ad/status/update/", {
  method: "POST",
  body: { advertiser_id: advertiserId, ad_ids: [adId], operation_status: status },
});
console.log(`\n/ad/status/update/ ${status}: code=${result.code} ${result.message ?? ""} request_id=${result.request_id ?? "—"}`);
await new Promise((r) => setTimeout(r, 1500));
await showStatus("Después");
