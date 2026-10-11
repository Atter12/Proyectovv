/**
 * Prueba de solo lectura de la Discovery API de TikTok para el Radar de Profit.
 *
 * Responde: ¿hay hashtags y videos top para Perú (y países vecinos) en las
 * categorías de nuestros clientes? ¿los videos se pueden insertar (oEmbed)?
 *
 * Uso:
 *   node --use-system-ca --env-file=.env.local scripts/probe-tiktok-discovery.mjs --advertiser=<advertiser_id>
 *
 * Opciones:
 *   --advertiser=ID      Cualquier cuenta del BC que cubra el token (obligatorio
 *                        si no está RADAR_PROBE_ADVERTISER_ID en el entorno).
 *   --countries=PE,MX,CO Países a probar.
 *   --categories=A,B     Categorías Discovery (category_name).
 *   --range=30DAY        1DAY | 7DAY | 30DAY | 120DAY.
 *
 * Requiere que la app tenga el permiso "Creative Management > Discovery".
 * Hace ~40 llamadas como máximo, en serie y con pausa: muy por debajo de los
 * límites de TikTok (10 por segundo en el nivel Basic).
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=")];
  }),
);

const token = (process.env.TIKTOK_ACCESS_TOKEN ?? "").trim();
const base = (process.env.TIKTOK_API_BASE_URL ?? "https://business-api.tiktok.com/open_api/v1.3").replace(/\/$/, "");
const advertiserId = (args.advertiser || process.env.RADAR_PROBE_ADVERTISER_ID || "").trim();
const countries = (args.countries || "PE,MX,CO").split(",").map((s) => s.trim()).filter(Boolean);
const categories = (
  args.categories ||
  "HEALTH,BEAUTY_AND_PERSONAL_CARE,APPAREL_AND_ACCESSORIES,HOME_IMPROVEMENT,HOUSEHOLD_PRODUCTS"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const dateRange = args.range || "30DAY";

if (!token) {
  console.error("Falta TIKTOK_ACCESS_TOKEN. Corre el script con --env-file=.env.local.");
  process.exit(1);
}
if (!advertiserId) {
  console.error("Falta --advertiser=<advertiser_id> (cualquier cuenta de nuestros BM).");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tiktokGet(path, query) {
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  await sleep(350);
  const res = await fetch(url, {
    headers: { "Access-Token": token },
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => ({}));
  return { httpStatus: res.status, ...json };
}

async function oembedAlive(shareUrl) {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(shareUrl)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const j = await res.json();
    return { ok: true, author: j.author_name ?? null, title: String(j.title ?? "").slice(0, 70) };
  } catch (e) {
    return { ok: false, status: String(e?.message ?? e) };
  }
}

const summary = [];

for (const country of countries) {
  for (const category of categories) {
    const tl = await tiktokGet("/discovery/trending_list/", {
      advertiser_id: advertiserId,
      discovery_type: "HASHTAG",
      country_code: country,
      category_name: category,
      date_range: dateRange,
    });

    if (tl.code !== 0) {
      console.log(`✗ ${country} · ${category}: code=${tl.code} ${tl.message ?? ""}`);
      summary.push({ country, category, hashtags: 0, videos: 0, error: `${tl.code} ${tl.message ?? ""}` });
      if (/permission|scope|authoriz/i.test(String(tl.message ?? ""))) {
        console.log("  → Parece que falta el permiso Discovery en la app. Actívalo y vuelve a correr.");
        process.exit(2);
      }
      continue;
    }

    const list = Array.isArray(tl.data?.list) ? tl.data.list : [];
    const effectiveCountry = tl.data?.filter_info?.country_code ?? country;
    console.log(
      `\n● ${country} · ${category}: ${list.length} hashtags (filtro aplicado: ${effectiveCountry}, ${dateRange})`,
    );
    for (const h of list.slice(0, 5)) {
      const tops = Array.isArray(h.top_country_list) ? h.top_country_list.join(",") : "—";
      console.log(`   #${h.hashtag_name}  rank ${h.rank_position}  vistas ${h.views ?? "—"}  top países: ${tops}`);
    }

    // video_list solo acepta países que estén en el top_country_list del hashtag.
    const eligible = list.filter(
      (h) => !Array.isArray(h.top_country_list) || h.top_country_list.includes(country),
    );
    const pick = eligible.slice(0, 3);
    let videos = [];
    if (pick.length > 0) {
      const vl = await tiktokGet("/discovery/video_list/", {
        advertiser_id: advertiserId,
        discovery_type: "HASHTAG",
        hashtag_ids: pick.map((h) => String(h.hashtag_id)),
        country_code: country,
        date_range: dateRange,
      });
      if (vl.code !== 0) {
        console.log(`   video_list ✗ code=${vl.code} ${vl.message ?? ""}`);
      } else {
        for (const group of vl.data?.list ?? []) {
          for (const v of group.top_video_list ?? []) videos.push({ ...v, hashtag: group.hashtag_name });
        }
        console.log(`   video_list: ${videos.length} videos para ${pick.map((h) => "#" + h.hashtag_name).join(" ")}`);
        const sample = videos[0];
        if (sample?.share_url) {
          const alive = await oembedAlive(sample.share_url);
          console.log(`   ejemplo: ${sample.share_url}`);
          console.log(`   oEmbed: ${alive.ok ? `ok · @${alive.author} · "${alive.title}"` : `falla (${alive.status})`}`);
        }
      }
    } else {
      console.log(`   Ningún hashtag tiene a ${country} en top_country_list: no hay videos para este país.`);
    }

    summary.push({
      country,
      category,
      hashtags: list.length,
      hashtagsWithCountry: eligible.length,
      videos: videos.length,
    });
  }
}

console.log("\nResumen");
console.table(summary);
const peOk = summary.some((r) => r.country === "PE" && r.videos > 0);
console.log(
  peOk
    ? "✓ Hay videos para Perú: el Radar puede usar PE como país principal."
    : "✗ Sin videos para Perú en esta prueba: usar MX/CO como respaldo (ver plan, sección 5).",
);
