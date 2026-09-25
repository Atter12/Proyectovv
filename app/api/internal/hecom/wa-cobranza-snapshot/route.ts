import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { loadWaCobranzaSnapshot } from "@/lib/hecom/cobranza-month-snapshot.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncTikTokAdvertiserSpend } from "@/lib/integrations/tiktok/client.server";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isAuthorized(request: Request): boolean {
  const expected = serverEnv.holisticWaSnapshotSecret;
  if (!expected) return false;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const header =
    request.headers.get("x-holistic-wa-snapshot-secret")?.trim() ||
    request.headers.get("x-wa-snapshot-secret")?.trim() ||
    "";
  return Boolean(
    (bearer && safeEqual(bearer, expected)) || (header && safeEqual(header, expected)),
  );
}

function parseBodyYm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4}-\d{2})/);
  return m ? m[1] : null;
}

function parseYmd(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

async function readInput(request: Request): Promise<{
  hecomClienteId: string;
  monthYm: string | null;
  corteYmd: string | null;
  refreshSpend: boolean;
}> {
  const url = new URL(request.url);
  let body: Record<string, unknown> = {};
  if (request.method !== "GET") {
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  const hecomClienteId = String(
    body.hecom_cliente_id ??
      body.hecomClienteId ??
      body.client_id ??
      body.clientId ??
      url.searchParams.get("hecom_cliente_id") ??
      url.searchParams.get("client_id") ??
      "",
  ).trim();

  const monthYm =
    parseBodyYm(body.periodo_ym ?? body.monthYm ?? body.ym ?? body.mes) ||
    parseBodyYm(url.searchParams.get("periodo_ym")) ||
    parseBodyYm(url.searchParams.get("ym")) ||
    null;

  const corteYmd =
    parseYmd(body.corte_ymd ?? body.corteYmd ?? body.corte) ||
    parseYmd(url.searchParams.get("corte_ymd")) ||
    null;

  const refreshRaw =
    body.refresh_spend ??
    body.refreshSpend ??
    url.searchParams.get("refresh_spend") ??
    "";
  const refreshSpend =
    refreshRaw === true ||
    refreshRaw === 1 ||
    String(refreshRaw).toLowerCase() === "1" ||
    String(refreshRaw).toLowerCase() === "true";

  return { hecomClienteId, monthYm, corteYmd, refreshSpend };
}

async function refreshClienteSpend(hecomClienteId: string, monthYm: string) {
  const orgId = await resolveOrganizationIdForHecomCliente(hecomClienteId);
  if (!orgId) {
    return { attempted: false, reason: "no_org", recordedCents: 0, recordedDays: 0 };
  }

  const today = todayYmdInTz("America/Lima");
  const startDate = `${monthYm}-01`;
  const endDate = today < startDate ? startDate : today;
  const admin = createAdminClient();
  const { data: adAccounts, error } = await admin
    .from("ad_accounts")
    .select("id, external_account_id, metadata")
    .eq("organization_id", orgId)
    .eq("platform", "tiktok")
    .not("external_account_id", "is", null);

  if (error) throw new Error(error.message);

  const matched = (adAccounts ?? []).filter((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const metaId = String(meta.hecom_cliente_id ?? meta.hecomClienteId ?? "").trim();
    return !metaId || metaId === hecomClienteId;
  });

  let recordedCents = 0;
  let recordedDays = 0;
  const failures: string[] = [];

  for (const account of matched) {
    if (!account.external_account_id) continue;
    try {
      const spend = await syncTikTokAdvertiserSpend({
        organizationId: orgId,
        adAccountId: account.id,
        advertiserId: account.external_account_id,
        startDate,
        endDate: endDate > shiftYmd(today, 0) ? today : endDate,
      });
      recordedCents += spend.recordedCents;
      recordedDays += spend.recordedDays;
    } catch (err) {
      failures.push(
        `${account.external_account_id}: ${err instanceof Error ? err.message : "error"}`,
      );
    }
  }

  return {
    attempted: true,
    organizationId: orgId,
    accounts: matched.length,
    recordedCents,
    recordedDays,
    range: { startDate, endDate },
    failures,
  };
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const input = await readInput(request);
  if (!input.hecomClienteId) {
    return NextResponse.json(
      { ok: false, error: "Falta hecom_cliente_id." },
      { status: 400 },
    );
  }

  const today = todayYmdInTz("America/Lima");
  const monthYm = input.monthYm || today.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(monthYm)) {
    return NextResponse.json({ ok: false, error: "periodo_ym inválido." }, { status: 400 });
  }

  let refresh: Awaited<ReturnType<typeof refreshClienteSpend>> | null = null;
  if (input.refreshSpend) {
    try {
      refresh = await refreshClienteSpend(input.hecomClienteId, monthYm);
    } catch (err) {
      refresh = {
        attempted: true,
        reason: err instanceof Error ? err.message : "refresh_failed",
        recordedCents: 0,
        recordedDays: 0,
      };
    }
  }

  const snapshot = await loadWaCobranzaSnapshot({
    hecomClienteId: input.hecomClienteId,
    monthYm,
    corteYmd: input.corteYmd,
  });

  if (!snapshot) {
    return NextResponse.json(
      { ok: false, error: "Cliente Hecom no encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    hecom_cliente_id: snapshot.hecomClienteId,
    nombre: snapshot.nombre,
    currency: snapshot.currency,
    periodo_ym: snapshot.monthYm,
    corte_ymd: snapshot.spendTo,
    from: snapshot.from,
    gasto: snapshot.gasto,
    fee: snapshot.fee,
    cargo: snapshot.cargo,
    cobrado: snapshot.cobrado,
    cobrado_bruto: snapshot.cobradoBruto,
    surcharge: snapshot.surcharge,
    del_mes: snapshot.delMes,
    deuda_corte: snapshot.deudaCorte,
    a_favor: snapshot.rangeSaldo > 0 ? snapshot.rangeSaldo : 0,
    range_saldo: snapshot.rangeSaldo,
    skip_cobranza: snapshot.skipCobranza,
    fee_percent: snapshot.feePercent,
    source: snapshot.source,
    peak_cargo: {
      fecha: snapshot.peakCargo.key,
      cargo: snapshot.peakCargo.cargo,
    },
    cobros: snapshot.cobros.map((row) => ({
      fecha: row.fecha,
      monto: row.applicable,
      monto_bruto: row.monto,
      metodo: row.metodo,
      periodo_resumen: row.periodoResumen,
    })),
    series: snapshot.series.map((row) => ({
      fecha: row.key,
      gasto_fee: row.cargo,
      pagado: row.paid,
      acumulado_cargo: row.cargoCum,
      acumulado_pagado: row.paidCum,
    })),
    refresh_spend: refresh,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
