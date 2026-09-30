import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { runPrepagoGuard } from "@/lib/payments/prepago-guard.server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Lectura de BM10/30 en TikTok + saldos + aviso a gerencia (de a dos por segundo).
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret =
    request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

/** Guardián de prepago: corrige y avisa. Ver lib/payments/prepago-guard.server.ts. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const result = await runPrepagoGuard();
    return NextResponse.json({
      ok: true,
      mode: result.mode,
      scannedAdvertisers: result.scannedAdvertisers,
      adsClientes: result.adsClientes,
      incidents: result.incidents.length,
      alerted: result.alerted,
      alertReason: result.alertReason,
    });
  } catch (error) {
    console.error("[prepago-guard] failed", error);
    // Que una revisión fallida no pase en silencio.
    await createAdminClient()
      .from("audit_logs")
      .insert({
        action: "prepago_guard.error",
        entity_type: "prepago_guard",
        metadata: { error: error instanceof Error ? error.message.slice(0, 500) : String(error) },
      })
      .then(
        () => undefined,
        () => undefined,
      );
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error del guardián." },
      { status: 500 },
    );
  }
}
