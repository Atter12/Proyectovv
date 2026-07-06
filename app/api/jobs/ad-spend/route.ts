import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordProviderAdSpend } from "@/lib/ledger/ledger.server";

interface ProviderSpendRecord {
  provider?: string;
  adAccountId?: string;
  externalAccountId?: string;
  amount?: number;
  amountCents?: number;
  occurredAt?: string;
  externalSpendId?: string;
  campaignId?: string | null;
  adSetId?: string | null;
  adId?: string | null;
  spendSource?: "available" | "reserved";
  metadata?: Record<string, unknown>;
}

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret = request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (bearer === expected || headerSecret === expected));
}

function normalizeAmountCents(record: ProviderSpendRecord): number {
  if (typeof record.amountCents === "number") return Math.round(record.amountCents);
  if (typeof record.amount === "number") return Math.round(record.amount * 100);
  return 0;
}

async function resolveAdAccount(record: ProviderSpendRecord): Promise<{
  id: string;
  organizationId: string;
}> {
  const admin = createAdminClient();

  if (record.adAccountId) {
    const { data, error } = await admin
      .from("ad_accounts")
      .select("id, organization_id")
      .eq("id", record.adAccountId)
      .maybeSingle<{ id: string; organization_id: string }>();

    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Cuenta publicitaria no encontrada: ${record.adAccountId}`);
    return { id: data.id, organizationId: data.organization_id };
  }

  if (!record.provider || !record.externalAccountId) {
    throw new Error("Envía adAccountId o provider + externalAccountId.");
  }

  const { data, error } = await admin
    .from("ad_accounts")
    .select("id, organization_id")
    .eq("platform", record.provider)
    .eq("external_account_id", record.externalAccountId)
    .maybeSingle<{ id: string; organization_id: string }>();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      `Cuenta publicitaria no encontrada para ${record.provider}:${record.externalAccountId}`,
    );
  }

  return { id: data.id, organizationId: data.organization_id };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let body: { records?: ProviderSpendRecord[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const records = Array.isArray(body.records) ? body.records : [];
  if (records.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, results: [] });
  }

  const results: Array<{ ok: boolean; journalId?: string; error?: string }> = [];

  for (const record of records) {
    try {
      const amountCents = normalizeAmountCents(record);
      if (amountCents <= 0) throw new Error("Monto de gasto inválido.");

      const adAccount = await resolveAdAccount(record);
      const provider = record.provider ?? "provider";
      const idempotencyKey = record.externalSpendId
        ? `ad_spend:${provider}:${record.externalSpendId}`
        : `ad_spend:${adAccount.id}:${record.occurredAt ?? "now"}:${amountCents}`;

      const journalId = await recordProviderAdSpend({
        organizationId: adAccount.organizationId,
        adAccountId: adAccount.id,
        amountCents,
        occurredAt: record.occurredAt,
        externalSpendId: record.externalSpendId ?? null,
        campaignId: record.campaignId ?? null,
        adSetId: record.adSetId ?? null,
        adId: record.adId ?? null,
        spendSource: record.spendSource ?? "available",
        idempotencyKey,
        metadata: {
          provider,
          external_account_id: record.externalAccountId ?? null,
          ...(record.metadata ?? {}),
        },
      });

      results.push({ ok: true, journalId });
    } catch (error) {
      results.push({
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  return NextResponse.json({
    ok: results.every((item) => item.ok),
    processed: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  });
}
