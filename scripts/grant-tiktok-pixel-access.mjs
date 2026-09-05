/**
 * Bulk-grant advertiser ADMIN (includes Pixel ops) to the OAuth user
 * across all Holistic BCs / advertisers we can see.
 *
 * TikTok: POST /bc/asset/assign/ with asset_type=ADVERTISER, advertiser_role=ADMIN
 *
 * Usage: node --env-file=.env.local scripts/grant-tiktok-pixel-access.mjs [--dry-run] [--limit=N]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  )
    v = v.slice(1, -1);
  env[t.slice(0, i).trim()] = v;
}

const token = (env.TIKTOK_ACCESS_TOKEN || "").trim();
if (!token) {
  console.error("Missing TIKTOK_ACCESS_TOKEN");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;
const onlyAdv = process.argv
  .find((a) => a.startsWith("--advertiser="))
  ?.split("=")[1];

async function tt(pathname, opts = {}) {
  const method = opts.method || "GET";
  let url = "https://business-api.tiktok.com/open_api/v1.3" + pathname;
  if (method === "GET" && opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v == null || v === "") continue;
      qs.set(k, String(v));
    }
    url += (pathname.includes("?") ? "&" : "?") + qs.toString();
  }
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, {
        method,
        headers: {
          "Access-Token": token,
          "Content-Type": "application/json",
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      return await r.json();
    } catch (e) {
      lastErr = e;
      await sleep(500 * attempt * attempt);
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const user = await tt("/user/info/");
  const coreUserId = String(user.data?.core_user_id || "");
  console.log("user", user.code, user.data?.display_name, coreUserId);
  if (!coreUserId) {
    console.error("No core_user_id");
    process.exit(1);
  }

  const bcRes = await tt("/bc/get/", { query: { page_size: 50 } });
  const bcs = (bcRes.data?.list || []).map((row) => ({
    bcId: String(row.bc_info?.bc_id || ""),
    name: String(row.bc_info?.name || ""),
    role: String(row.user_role || ""),
  }));
  console.log(
    "BCs",
    bcs.map((b) => `${b.name}(${b.bcId}) role=${b.role}`).join(" | "),
  );

  // Resolve BC member user_id (may differ from core_user_id)
  const memberIdsByBc = new Map();
  for (const bc of bcs) {
    if (!bc.bcId) continue;
    const mem = await tt("/bc/member/get/", {
      query: { bc_id: bc.bcId, page_size: 50 },
    });
    const list = mem.data?.list || [];
    let hit =
      list.find((m) => String(m.user_id || m.bc_member_user_id || "") === coreUserId) ||
      list.find(
        (m) =>
          String(m.user_email || m.email || "")
            .toLowerCase()
            .includes("atter") ||
          String(m.user_name || "").toLowerCase().includes("atter"),
      ) ||
      list.find((m) => String(m.user_role || m.role || "") === "ADMIN");
    // Prefer matching core_user_id field variants
    for (const m of list) {
      const uid = String(m.user_id || "");
      const cid = String(m.core_user_id || m.ext_user_id || "");
      if (uid === coreUserId || cid === coreUserId) {
        hit = m;
        break;
      }
    }
    const uid = String(hit?.user_id || coreUserId);
    memberIdsByBc.set(bc.bcId, uid);
    console.log(
      "member",
      bc.name,
      "user_id=",
      uid,
      "members=",
      list.length,
      mem.code,
    );
  }

  // Collect advertisers from each BC
  const advertisers = [];
  for (const bc of bcs) {
    if (!bc.bcId) continue;
    let page = 1;
    for (;;) {
      const res = await tt("/bc/asset/admin/get/", {
        query: {
          bc_id: bc.bcId,
          asset_type: "ADVERTISER",
          page,
          page_size: 50,
        },
      });
      if (res.code !== 0) {
        // fallback
        const res2 = await tt("/bc/advertiser/get/", {
          query: { bc_id: bc.bcId, page, page_size: 50 },
        });
        const list2 = res2.data?.list || [];
        for (const row of list2) {
          const id = String(
            row.asset_id || row.advertiser_id || row.id || "",
          );
          if (!id) continue;
          advertisers.push({
            advertiserId: id,
            name: String(row.asset_name || row.advertiser_name || row.name || id),
            bcId: bc.bcId,
            bcName: bc.name,
          });
        }
        if (list2.length < 50) break;
        page += 1;
        continue;
      }
      const list = res.data?.list || [];
      for (const row of list) {
        const id = String(row.asset_id || row.advertiser_id || "");
        if (!id) continue;
        advertisers.push({
          advertiserId: id,
          name: String(row.asset_name || row.advertiser_name || id),
          bcId: bc.bcId,
          bcName: bc.name,
        });
      }
      const total = Number(res.data?.page_info?.total_number || 0);
      if (list.length < 50 || page * 50 >= total) break;
      page += 1;
      await sleep(120);
    }
  }

  // Dedupe by advertiser
  const byId = new Map();
  for (const a of advertisers) {
    if (!byId.has(a.advertiserId)) byId.set(a.advertiserId, a);
  }
  let targets = [...byId.values()];
  if (onlyAdv) targets = targets.filter((t) => t.advertiserId === onlyAdv);
  if (limit > 0) targets = targets.slice(0, limit);

  console.log("advertisers_unique", byId.size, "targets", targets.length, dryRun ? "DRY_RUN" : "LIVE");

  // Probe Brian first if present
  const brian = targets.find((t) => t.advertiserId === "7679177988396204050");
  if (brian) console.log("includes Brian advertiser", brian);

  const summary = {
    ok: 0,
    fail: 0,
    skip: 0,
    alreadyPixelOk: 0,
    pixelOkAfter: 0,
    pixelFailAfter: 0,
  };
  const fails = [];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const userId = memberIdsByBc.get(t.bcId) || coreUserId;
    process.stdout.write(
      `[${i + 1}/${targets.length}] ${t.bcName} ${t.advertiserId} … `,
    );

    // Skip assign if pixel/list already works
    const before = await tt("/pixel/list/", {
      query: {
        advertiser_id: t.advertiserId,
        page: 1,
        page_size: 1,
      },
    });
    if (before.code === 0) {
      summary.alreadyPixelOk += 1;
      console.log("pixel already OK");
      await sleep(80);
      continue;
    }

    if (dryRun) {
      console.log("would-assign (list=" + before.code + ")");
      summary.skip += 1;
      continue;
    }

    const assign = await tt("/bc/asset/assign/", {
      method: "POST",
      body: {
        bc_id: t.bcId,
        user_id: userId,
        asset_type: "ADVERTISER",
        asset_id: t.advertiserId,
        advertiser_role: "ADMIN",
      },
    });
    if (assign.code === 0) {
      summary.ok += 1;
      process.stdout.write("assign=OK ");
    } else {
      summary.fail += 1;
      fails.push({
        advertiserId: t.advertiserId,
        bcId: t.bcId,
        code: assign.code,
        message: assign.message,
      });
      process.stdout.write(
        `assign=${assign.code}:${String(assign.message || "").slice(0, 50)} `,
      );
    }

    // TikTok quirk: list may still 40001 while create/update work after ADMIN assign.
    const pix = await tt("/pixel/list/", {
      query: {
        advertiser_id: t.advertiserId,
        page: 1,
        page_size: 1,
      },
    });
    if (pix.code === 0) {
      summary.pixelOkAfter += 1;
      console.log("pixel/list=OK");
    } else {
      summary.pixelFailAfter += 1;
      // Note: TikTok often keeps /pixel/list 40001 even when create/update work.
      console.log(
        `pixel/list=${pix.code}:${String(pix.message || "").slice(0, 70)} (create may still work)`,
      );
    }
    await sleep(120);
  }

  console.log("\nSUMMARY", summary);
  console.log(
    "Note: after ADMIN assign, Crear píxel usually works even if Ver píxeles (list) still 40001.",
  );
  if (fails.length) {
    console.log("assign_fail_sample", fails.slice(0, 15));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
