import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { importTikTokAdvertiserAccounts } from "@/lib/integrations/tiktok/client.server";

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret = request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integration_connections")
    .select("organization_id, created_by")
    .eq("provider", "tiktok")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let imported = 0;
  const failures: Array<{ organizationId: string; error: string }> = [];

  for (const connection of data ?? []) {
    try {
      const result = await importTikTokAdvertiserAccounts({
        organizationId: connection.organization_id,
        userId: connection.created_by ?? null,
      });
      imported += result.imported;
    } catch (syncError) {
      failures.push({
        organizationId: connection.organization_id,
        error: syncError instanceof Error ? syncError.message : "Error desconocido",
      });
    }
  }

  return NextResponse.json({ ok: true, imported, failures });
}
