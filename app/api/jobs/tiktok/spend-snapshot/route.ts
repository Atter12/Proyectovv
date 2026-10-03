import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTikTokDailySpend } from "@/lib/integrations/tiktok/client.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { todayYmdInTz } from "@/lib/hecom/gasto-date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * SOLO LECTURA. Guarda en audit_logs el gasto diario que reporta TikTok para
 * los clientes afectados por el registro de gasto atrasado del 01/10/2026,
 * desde julio hasta hoy, para calcular cuánto devolverles. No toca saldos ni
 * presupuestos. Corre una vez: si ya hay una foto completa, no hace nada.
 */
/** v2: la primera foto chocó con el límite de 10 consultas/s de TikTok. */
const AUDIT_ACTION = "tiktok.spend_snapshot.v2";
const CONCURRENCY = 2;
const BACKFILL_FROM = "2026-10-01T15:00:00Z";
const BACKFILL_TO = "2026-10-03T06:00:00Z";
/** TikTok acepta hasta 30 días por consulta diaria. */
const WINDOWS: Array<[string, string]> = [
  ["2026-07-01", "2026-07-30"],
  ["2026-07-31", "2026-08-29"],
  ["2026-08-30", "2026-09-28"],
];

/** TikTok corta con "QPS limit": espera y reintenta. */
async function withQpsRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!/qps limit/i.test(message) || attempt >= 4) throw e;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
}

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && token === expected);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const admin = createAdminClient();

  // Se retoma: cada corrida guarda lo que consiguió y la siguiente sigue con el resto.
  const { data: previous } = await admin
    .from("audit_logs")
    .select("metadata")
    .eq("action", AUDIT_ACTION);
  if ((previous ?? []).some((r) => r.metadata?.complete)) {
    return NextResponse.json({ ok: true, done: true });
  }
  const finished = new Set<string>();
  for (const r of previous ?? []) {
    for (const a of (r.metadata?.advertisers ?? []) as Array<{ advertiserId: string; error?: string }>) {
      // Sin permiso no se arregla reintentando.
      if (!a.error || /no permission/i.test(a.error)) finished.add(a.advertiserId);
    }
  }

  // Clientes con gasto atrasado asentado en esa ventana → todos sus anunciantes.
  const { data: spends, error } = await admin
    .from("ad_spend_transactions")
    .select("ad_account_id")
    .gte("created_at", BACKFILL_FROM)
    .lt("created_at", BACKFILL_TO)
    .lt("occurred_at", "2026-09-30T00:00:00Z");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const accountIds = [...new Set((spends ?? []).map((s) => String(s.ad_account_id)))];
  const { data: touched } = await admin
    .from("ad_accounts")
    .select("hecom_cliente_id:metadata->>hecom_cliente_id")
    .in("id", accountIds);
  const hecomIds = [
    ...new Set((touched ?? []).map((a) => String(a.hecom_cliente_id ?? "")).filter(Boolean)),
  ];
  const { data: rows } = await admin
    .from("ad_accounts")
    .select("external_account_id, organization_id, hecom_cliente_id:metadata->>hecom_cliente_id")
    .eq("platform", "tiktok")
    .in("metadata->>hecom_cliente_id", hecomIds);
  const advertisers = new Map<string, { hecomId: string; organizationId: string }>();
  for (const r of rows ?? []) {
    const adv = String(r.external_account_id ?? "").trim();
    if (adv && !advertisers.has(adv)) {
      advertisers.set(adv, { hecomId: String(r.hecom_cliente_id), organizationId: r.organization_id });
    }
  }

  const today = todayYmdInTz("America/Lima");
  const windows: Array<[string, string]> = [...WINDOWS, ["2026-09-29", today]];
  const deadline = Date.now() + 230_000;
  const result: Array<{
    advertiserId: string;
    hecomId: string;
    days: Array<[string, number]>;
    error?: string;
  }> = [];
  const queue = [...advertisers.entries()].filter(([adv]) => !finished.has(adv));
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < queue.length && Date.now() < deadline) {
        const [advertiserId, meta] = queue[next++]!;
        const entry = { advertiserId, hecomId: meta.hecomId, days: [] as Array<[string, number]>, error: undefined as string | undefined };
        try {
          const { token } = await resolveTikTokFinanceAccessToken(meta.organizationId);
          for (const [startDate, endDate] of windows) {
            const days = await withQpsRetry(() =>
              getTikTokDailySpend({
                organizationId: meta.organizationId,
                advertiserId,
                startDate,
                endDate,
                accessToken: token,
              }),
            );
            for (const d of days) if (d.amountCents > 0) entry.days.push([d.date, d.amountCents]);
          }
        } catch (e) {
          entry.error = e instanceof Error ? e.message : String(e);
        }
        result.push(entry);
      }
    }),
  );

  const complete =
    result.length === queue.length && result.every((r) => !r.error || /no permission/i.test(r.error));
  await admin.from("audit_logs").insert({
    action: AUDIT_ACTION,
    entity_type: "tiktok_spend_snapshot",
    metadata: { complete, taken_on: today, clientes: hecomIds.length, advertisers: result },
  });
  return NextResponse.json({ ok: true, complete, advertisers: result.length, of: queue.length });
}
