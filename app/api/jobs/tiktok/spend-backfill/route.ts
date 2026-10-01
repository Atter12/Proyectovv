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
const MAX_RETRIES = 3;

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
    .maybeSingle<{
      metadata: {
        start_date?: string;
        end_date?: string;
        pending_advertiser_ids?: string[];
        attempt?: number;
      } | null;
    }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Si la corrida anterior no alcanzó a todos, se retoman esos en el mismo rango.
  const resume = last?.metadata?.pending_advertiser_ids ?? [];
  const attempt = resume.length ? (last?.metadata?.attempt ?? 0) + 1 : 0;
  let startDate: string;
  let endDate: string;
  if (resume.length && last?.metadata?.start_date && last.metadata.end_date) {
    startDate = last.metadata.start_date;
    endDate = last.metadata.end_date;
  } else {
    // El sync normal ya cubre ayer y hoy.
    const lastDay = shiftYmd(todayYmdInTz("America/Lima"), -2);
    startDate = last?.metadata?.end_date ? shiftYmd(last.metadata.end_date, 1) : BACKFILL_FROM;
    if (startDate > lastDay) {
      return NextResponse.json({ ok: true, done: true, through: last?.metadata?.end_date ?? null });
    }
    const chunkEnd = shiftYmd(startDate, CHUNK_DAYS - 1);
    endDate = chunkEnd < lastDay ? chunkEnd : lastDay;
  }

  // Solo cuentas de clientes: el camino OAuth (reimporta cuentas) no entra en el tiempo.
  const query = new URLSearchParams({ start_date: startDate, end_date: endDate, skip_oauth: "1" });
  if (resume.length) query.set("advertiser_ids", resume.join(","));
  const response = await runSpendSync(
    new Request(`${new URL(request.url).origin}/api/jobs/tiktok/sync?${query}`, {
      headers: { authorization: `Bearer ${serverEnv.cronSecret || serverEnv.internalJobSecret}` },
    }),
  );
  const result = (await response.json()) as {
    recordedDays?: number;
    recordedCents?: number;
    uncoveredCents?: number;
    uncovered?: unknown[];
    pendingAdvertiserIds?: string[];
    skipped?: unknown[];
    failures?: Array<{ organizationId: string; advertiserId?: string; error: string }>;
    error?: string;
  };

  const failures = result.failures ?? [];
  // Los que fallaron (límite de TikTok, demora) se reintentan con los que no
  // alcanzaron, hasta 3 veces; después se sigue y quedan en el registro.
  const retry = new Set(result.pendingAdvertiserIds ?? []);
  if (attempt < MAX_RETRIES) {
    for (const f of failures) {
      // Sin permiso sobre el anunciante (cuenta fuera de los BM de la agencia):
      // reintentar no lo arregla.
      if (f.advertiserId && !/no permission/i.test(f.error)) retry.add(f.advertiserId);
    }
  }
  const advanced = response.ok;
  if (advanced) {
    await admin.from("audit_logs").insert({
      action: AUDIT_ACTION,
      entity_type: "tiktok_spend_backfill",
      severity: failures.length ? "warning" : "info",
      metadata: {
        start_date: startDate,
        end_date: endDate,
        resumed: resume.length,
        attempt,
        pending_advertiser_ids: [...retry],
        recorded_days: result.recordedDays ?? 0,
        recorded_cents: result.recordedCents ?? 0,
        uncovered_cents: result.uncoveredCents ?? 0,
        uncovered: (result.uncovered ?? []).slice(0, 300),
        skipped: result.skipped ?? [],
        failures: failures.slice(0, 50),
      },
    });
  } else {
    console.error("[spend-backfill] rango no avanzado", {
      startDate,
      endDate,
      status: response.status,
      failures: failures.length,
      error: result.error,
      sample: failures.slice(0, 3).map((f) => f.error),
    });
  }

  return NextResponse.json({
    ok: advanced,
    range: { startDate, endDate },
    resumed: resume.length,
    pending: retry.size,
    recordedCents: result.recordedCents ?? 0,
    uncoveredCents: result.uncoveredCents ?? 0,
    failures: failures.length,
  });
}
