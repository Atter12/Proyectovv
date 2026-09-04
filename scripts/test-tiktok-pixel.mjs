/**
 * Dry-run / smoke test TikTok Pixel API (list → optional create).
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-tiktok-pixel.mjs <advertiser_id> [--create]
 *   node --env-file=.env.local scripts/test-tiktok-pixel.mjs <advertiser_id> --create --name "Test Pixel Holistic"
 */
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const p = path.resolve(".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnv();

const advertiserId = process.argv[2]?.trim();
const doCreate = process.argv.includes("--create");
const nameIdx = process.argv.indexOf("--name");
const pixelName =
  nameIdx >= 0
    ? process.argv[nameIdx + 1]
    : `Holistic Test ${new Date().toISOString().slice(0, 16)}`;

if (!advertiserId) {
  console.error(
    "Usage: node scripts/test-tiktok-pixel.mjs <advertiser_id> [--create] [--name \"...\"]",
  );
  process.exit(1);
}

const base = (
  process.env.TIKTOK_API_BASE_URL ||
  "https://business-api.tiktok.com/open_api/v1.3"
).replace(/\/$/, "");
const token = (process.env.TIKTOK_ACCESS_TOKEN || "").trim();
if (!token) {
  console.error("Missing TIKTOK_ACCESS_TOKEN");
  process.exit(1);
}

async function call(method, apiPath, { query, body } = {}) {
  const url = new URL(`${base}${apiPath}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method,
    headers: {
      "Access-Token": token,
      Accept: "application/json",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { http: res.status, json };
}

console.log("LIST pixels for", advertiserId);
const listed = await call("GET", "/pixel/list/", {
  query: { advertiser_id: advertiserId, page: "1", page_size: "20" },
});
console.log(JSON.stringify(listed, null, 2));

if (!doCreate) {
  console.log("\n(Omit --create: solo list. Para crear: añade --create)");
  process.exit(listed.json?.code === 0 ? 0 : 2);
}

console.log("\nCREATE pixel", pixelName);
const created = await call("POST", "/pixel/create/", {
  body: {
    advertiser_id: advertiserId,
    pixel_name: pixelName,
    pixel_category: "ONLINE_STORE",
  },
});
console.log(JSON.stringify(created, null, 2));

const pixelId =
  created.json?.data?.pixel_id ||
  created.json?.data?.pixelId ||
  null;

if (pixelId) {
  console.log("\nRe-LIST after create");
  const again = await call("GET", "/pixel/list/", {
    query: { advertiser_id: advertiserId, page: "1", page_size: "20" },
  });
  const rows = again.json?.data?.pixels || again.json?.data?.list || [];
  const found = rows.find(
    (r) => String(r.pixel_id || r.pixelId) === String(pixelId),
  );
  console.log("found in list:", Boolean(found), { pixelId });
}

process.exit(created.json?.code === 0 ? 0 : 2);
