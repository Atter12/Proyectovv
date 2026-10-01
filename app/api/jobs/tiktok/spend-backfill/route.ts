import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { GET as runSpendSync } from "@/app/api/jobs/tiktok/sync/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Registro del gasto atrasado: hasta el 17/09/2026 el gasto de TikTok no se
 * asentaba en el libro, así que el saldo asignado de cada cuenta seguía
 * mostrando lo ya gastado. Cada corrida procesa cuatro días, desde la primera
 * asignación, hasta alcanzar los días que ya cubre el sync normal (ayer y hoy).
 * El sync solo asienta la diferencia contra lo ya registrado por día, así que
 * repetir un rango no duplica (si una corrida se corta, la siguiente la repite).
 */
const BACKFILL_FROM = "2026-07-06";
const CHUNK_DAYS = 4;
const AUDIT_ACTION = "tiktok.spend_backfill.chunk";

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret =
    request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: last, error } = await admin
    .from("audit_logs")
    .select("metadata")
    .eq("action", AUDIT_ACTION)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ metadata: { end_date?: string } | null }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // El sync normal ya cubre ayer y hoy.
  const lastDay = shiftYmd(todayYmdInTz("America/Lima"), -2);
  const startDate = last?.metadata?.end_date ? shiftYmd(last.metadata.end_date, 1) : BACKFILL_FROM;
  if (startDate > lastDay) {
    return NextResponse.json({ ok: true, done: true, through: last?.metadata?.end_date ?? null });
  }
  const chunkEnd = shiftYmd(startDate, CHUNK_DAYS - 1);
  const endDate = chunkEnd < lastDay ? chunkEnd : lastDay;

  const response = await runSpendSync(
    new Request(
      `${new URL(request.url).origin}/api/jobs/tiktok/sync?start_date=${startDate}&end_date=${endDate}`,
      { headers: { authorization: `Bearer ${serverEnv.cronSecret || serverEnv.internalJobSecret}` } },
    ),
  );
  const result = (await response.json()) as {
    ok?: boolean;
    recordedDays?: number;
    recordedCents?: number;
    uncoveredCents?: number;
    uncovered?: unknown[];
    skipped?: unknown[];
    failures?: Array<{ organizationId: string; error: string }>;
    error?: string;
  };

  const failures = result.failures ?? [];
  // Si falló casi todo (token, TikTok caído) no se avanza: se reintenta la misma semana.
  const advanced = response.ok && failures.length < 20;
  if (advanced) {
    await admin.from("audit_logs").insert({
      action: AUDIT_ACTION,
      entity_type: "tiktok_spend_backfill",
      severity: failures.length ? "warning" : "info",
      metadata: {
        start_date: startDate,
        end_date: endDate,
        recorded_days: result.recordedDays ?? 0,
        recorded_cents: result.recordedCents ?? 0,
        uncovered_cents: result.uncoveredCents ?? 0,
        uncovered: (result.uncovered ?? []).slice(0, 300),
        skipped: result.skipped ?? [],
        failures: failures.slice(0, 50),
      },
    });
  } else {
    console.error("[spend-backfill] semana no avanzada", {
      startDate,
      endDate,
      status: response.status,
      failures: failures.length,
      error: result.error,
    });
  }

  return NextResponse.json({
    ok: advanced,
    range: { startDate, endDate },
    recordedCents: result.recordedCents ?? 0,
    uncoveredCents: result.uncoveredCents ?? 0,
    failures: failures.length,
  });
}
