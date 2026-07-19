import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  importTikTokAdvertiserAccounts,
  syncTikTokAdvertiserSpend,
} from "@/lib/integrations/tiktok/client.server";

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret = request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function resolveDateRange(request: Request): { startDate: string; endDate: string } {
  const url = new URL(request.url);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const requestedStart = url.searchParams.get("start_date");
  const requestedEnd = url.searchParams.get("end_date");
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  return {
    startDate: requestedStart && datePattern.test(requestedStart)
      ? requestedStart
      : dateOnly(yesterday),
    endDate: requestedEnd && datePattern.test(requestedEnd)
      ? requestedEnd
      : dateOnly(today),
  };
}

async function runSync(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { startDate, endDate } = resolveDateRange(request);
  if (startDate > endDate) {
    return NextResponse.json(
      { error: "start_date no puede ser posterior a end_date." },
      { status: 400 },
    );
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
  let recordedCents = 0;
  let recordedDays = 0;
  const failures: Array<{ organizationId: string; error: string }> = [];
  const spendResults: Array<{
    organizationId: string;
    advertiserId: string;
    reportedDays: number;
    recordedDays: number;
    recordedCents: number;
    adjustments: Array<{
      date: string;
      reportedCents: number;
      alreadyRecordedCents: number;
    }>;
  }> = [];

  for (const connection of data ?? []) {
    try {
      const result = await importTikTokAdvertiserAccounts({
        organizationId: connection.organization_id,
        userId: connection.created_by ?? null,
      });
      imported += result.imported;

      const { data: adAccounts, error: adAccountsError } = await admin
        .from("ad_accounts")
        .select("id, external_account_id")
        .eq("organization_id", connection.organization_id)
        .eq("platform", "tiktok")
        .not("external_account_id", "is", null);
      if (adAccountsError) throw new Error(adAccountsError.message);

      for (const account of adAccounts ?? []) {
        if (!account.external_account_id) continue;
        try {
          const spend = await syncTikTokAdvertiserSpend({
            organizationId: connection.organization_id,
            adAccountId: account.id,
            advertiserId: account.external_account_id,
            startDate,
            endDate,
          });
          recordedCents += spend.recordedCents;
          recordedDays += spend.recordedDays;
          spendResults.push({
            organizationId: connection.organization_id,
            ...spend,
          });
        } catch (spendError) {
          failures.push({
            organizationId: connection.organization_id,
            error: `Advertiser ${account.external_account_id}: ${
              spendError instanceof Error ? spendError.message : "Error desconocido"
            }`,
          });
        }
      }
    } catch (syncError) {
      failures.push({
        organizationId: connection.organization_id,
        error: syncError instanceof Error ? syncError.message : "Error desconocido",
      });
    }
  }

  return NextResponse.json({
    ok: failures.length === 0,
    range: { startDate, endDate },
    imported,
    recordedDays,
    recordedCents,
    spendResults,
    failures,
  });
}

export async function GET(request: Request) {
  return runSync(request);
}

export async function POST(request: Request) {
  return runSync(request);
}
