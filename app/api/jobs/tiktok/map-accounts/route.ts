import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoMapTikTokAccounts } from "@/lib/hecom/auto-map-tiktok-accounts.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && token === expected);
}

/** Cada hora: vincula a su cliente las cuentas TikTok nuevas que se crearon fuera del panel. ?dry_run=1 solo muestra. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry_run") === "1";
  try {
    const result = await autoMapTikTokAccounts({ commit: !dry });
    if (!dry && (result.linked.length || result.errors.length)) {
      await createAdminClient().from("audit_logs").insert({
        action: "tiktok.auto_map_accounts",
        entity_type: "ad_accounts",
        metadata: { linked: result.linked, ambiguous: result.ambiguous, errors: result.errors },
      });
    }
    return NextResponse.json({ ok: true, dry_run: dry, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "error" }, { status: 500 });
  }
}
