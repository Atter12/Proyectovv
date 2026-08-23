/**
 * Cliente HTTP Hecom (Supabase REST) sin @supabase/supabase-js.
 *
 * Si en Windows ves UNABLE_TO_VERIFY_LEAF_SIGNATURE (antivirus/proxy SSL),
 * agregá en .env.local solo para scripts locales:
 *   HECOM_SCRIPT_TLS_INSECURE=true
 */
import https from "node:https";

let insecureAgent = null;

function isTlsInsecureEnabled() {
  return process.env.HECOM_SCRIPT_TLS_INSECURE === "true";
}

function getAgent(insecure) {
  if (!insecure) return undefined;
  if (!insecureAgent) {
    insecureAgent = new https.Agent({ rejectUnauthorized: false });
  }
  return insecureAgent;
}

export function getHecomConfig() {
  const hecomUrl = process.env.HECOM_SUPABASE_URL?.trim();
  const hecomKey = process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!hecomUrl || !hecomKey) {
    throw new Error(
      "Faltan HECOM_SUPABASE_URL o HECOM_SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }
  return { hecomUrl, hecomKey };
}

function isTlsError(error) {
  const code = error && typeof error === "object" ? error.code : "";
  const message = String(error?.message ?? "");
  return (
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    /certificate/i.test(message)
  );
}

function tlsHelp() {
  return (
    "\n\nTLS en Windows (antivirus/proxy):\n" +
    "  1) Agregá en .env.local: HECOM_SCRIPT_TLS_INSECURE=true\n" +
    "  2) Volvé a correr: npm run audit:hecom\n" +
    "  3) O pegá el SQL de tmp/hecom-stale-fixes-safe.sql en Supabase Hecom SQL Editor"
  );
}

function hecomRequestOnce(method, path, body, insecure) {
  return new Promise((resolve, reject) => {
    const { hecomUrl, hecomKey } = getHecomConfig();
    const url = new URL(path, hecomUrl);
    const payload = body != null ? JSON.stringify(body) : null;

    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method,
        agent: getAgent(insecure),
        headers: {
          apikey: hecomKey,
          Authorization: `Bearer ${hecomKey}`,
          Accept: "application/json",
          ...(payload
            ? {
                "Content-Type": "application/json",
                Prefer: "return=representation",
              }
            : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if ((res.statusCode ?? 500) >= 400) {
            reject(
              new Error(
                `Hecom ${method} HTTP ${res.statusCode}: ${data.slice(0, 320)}`,
              ),
            );
            return;
          }
          if (!data.trim()) {
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(
              new Error(
                `Hecom JSON inválido: ${error instanceof Error ? error.message : "unknown"}`,
              ),
            );
          }
        });
      },
    );

    req.on("error", reject);
    req.setTimeout(45_000, () => {
      req.destroy(new Error(`Hecom ${method} timeout`));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

export async function hecomRequest(method, path, body) {
  try {
    return await hecomRequestOnce(method, path, body, false);
  } catch (error) {
    if (isTlsError(error) && isTlsInsecureEnabled()) {
      console.warn(
        "[hecom-http] TLS falló; reintentando con HECOM_SCRIPT_TLS_INSECURE=true",
      );
      return hecomRequestOnce(method, path, body, true);
    }
    if (isTlsError(error)) {
      throw new Error(`${error.message}${tlsHelp()}`);
    }
    throw error;
  }
}

export async function loadHecomCrm() {
  const [clientes, cuentas] = await Promise.all([
    hecomRequest(
      "GET",
      `/rest/v1/clientes?select=${encodeURIComponent("id,name,tiktok_advertiser_id,tiktok_sync_enabled")}&limit=500`,
    ),
    hecomRequest(
      "GET",
      `/rest/v1/cliente_tiktok_cuentas?select=${encodeURIComponent("id,client_id,advertiser_id,advertiser_name,bm_bucket,fee,sync_enabled")}&limit=5000`,
    ),
  ]);
  return {
    clientes: clientes ?? [],
    cuentas: cuentas ?? [],
  };
}

export async function updateHecomTiktokCuenta(input) {
  const qs = [
    `client_id=eq.${encodeURIComponent(input.clientId)}`,
    `advertiser_id=eq.${encodeURIComponent(input.oldAdvertiserId)}`,
  ].join("&");
  const rows = await hecomRequest(
    "PATCH",
    `/rest/v1/cliente_tiktok_cuentas?${qs}`,
    input.patch,
  );
  return Array.isArray(rows) ? rows[0] : rows;
}
