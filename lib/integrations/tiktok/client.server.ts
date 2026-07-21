import { createAdminClient } from "@/lib/supabase/admin";
import { encryptJson, decryptJson } from "@/lib/crypto/encryption.server";
import { serverEnv } from "@/lib/env/env.server";
import {
  ensureAdAccountLedgerAccounts,
  recordProviderAdSpend,
} from "@/lib/ledger/ledger.server";
import type {
  TikTokAdvertiserAccount,
  TikTokIntegrationConnection,
  TikTokTokenBundle,
} from "./types";

interface TikTokApiResponse<T> {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
}

interface TikTokTokenResponseData {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  scope?: string | string[];
}

interface TikTokAdvertiserListData {
  list?: Array<Record<string, unknown>>;
  advertiser_ids?: string[];
}

interface TikTokReportData {
  list?: Array<{
    dimensions?: Record<string, unknown>;
    metrics?: Record<string, unknown>;
  }>;
}

export interface TikTokSpendSyncResult {
  advertiserId: string;
  reportedDays: number;
  recordedDays: number;
  recordedCents: number;
  adjustments: Array<{
    date: string;
    reportedCents: number;
    alreadyRecordedCents: number;
  }>;
}

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeScopes(scope?: string | string[]): string[] {
  if (Array.isArray(scope)) return scope;
  if (!scope) return [];
  return scope.split(/[ ,]+/).map((item) => item.trim()).filter(Boolean);
}

function tokenBundleFromResponse(
  data: TikTokTokenResponseData,
  raw: TikTokApiResponse<TikTokTokenResponseData>,
  fallback?: TikTokTokenBundle,
): TikTokTokenBundle {
  const now = Date.now();
  return {
    accessToken: data.access_token ?? fallback?.accessToken ?? "",
    refreshToken: data.refresh_token ?? fallback?.refreshToken ?? null,
    expiresAt: data.expires_in
      ? new Date(now + data.expires_in * 1000).toISOString()
      : fallback?.expiresAt ?? null,
    refreshExpiresAt: data.refresh_expires_in
      ? new Date(now + data.refresh_expires_in * 1000).toISOString()
      : fallback?.refreshExpiresAt ?? null,
    scopes: normalizeScopes(data.scope).length > 0
      ? normalizeScopes(data.scope)
      : fallback?.scopes ?? [],
    raw: raw as unknown as Record<string, unknown>,
  };
}

export async function exchangeTikTokAuthCode(
  authCode: string,
): Promise<TikTokTokenBundle> {
  if (!serverEnv.tiktokClientKey || !serverEnv.tiktokClientSecret) {
    throw new Error("[tiktok] TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET son obligatorios.");
  }

  const response = await fetch(apiUrl("/oauth2/access_token/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: serverEnv.tiktokClientKey,
      secret: serverEnv.tiktokClientSecret,
      auth_code: authCode,
    }),
    cache: "no-store",
  });

  const json = (await response.json()) as TikTokApiResponse<TikTokTokenResponseData>;
  if (!response.ok || !json.data?.access_token) {
    throw new Error(json.message ?? "No se pudo intercambiar el código de TikTok.");
  }

  return tokenBundleFromResponse(json.data, json);
}

export async function upsertTikTokConnection(input: {
  organizationId: string;
  userId: string;
  tokenBundle: TikTokTokenBundle;
}): Promise<string> {
  const admin = createAdminClient();
  const encryptedCredentials = {
    ciphertext: encryptJson(input.tokenBundle),
    expires_at: input.tokenBundle.expiresAt ?? null,
    refresh_expires_at: input.tokenBundle.refreshExpiresAt ?? null,
  };

  const { data, error } = await admin
    .from("integration_connections")
    .upsert(
      {
        organization_id: input.organizationId,
        provider: "tiktok",
        name: "TikTok Business",
        status: "active",
        external_account_id: "oauth",
        encrypted_credentials: encryptedCredentials,
        scopes: input.tokenBundle.scopes,
        created_by: input.userId ?? null,
        metadata: {
          expires_at: input.tokenBundle.expiresAt ?? null,
          refresh_expires_at: input.tokenBundle.refreshExpiresAt ?? null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" },
    )
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo guardar la conexión de TikTok.");
  }
  return data.id;
}

export async function getTikTokConnection(
  organizationId: string,
): Promise<TikTokIntegrationConnection | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integration_connections")
    .select("id, organization_id, encrypted_credentials, scopes")
    .eq("organization_id", organizationId)
    .eq("provider", "tiktok")
    .eq("status", "active")
    .maybeSingle<{
      id: string;
      organization_id: string;
      encrypted_credentials: { ciphertext?: string } | null;
      scopes: string[] | null;
    }>();

  if (error || !data?.encrypted_credentials?.ciphertext) return null;
  let bundle = decryptJson<TikTokTokenBundle>(data.encrypted_credentials.ciphertext);
  const expiresAt = bundle.expiresAt ? Date.parse(bundle.expiresAt) : Number.POSITIVE_INFINITY;
  const shouldRefresh = expiresAt - Date.now() < 10 * 60_000;

  if (shouldRefresh && bundle.refreshToken) {
    if (!serverEnv.tiktokClientKey || !serverEnv.tiktokClientSecret) {
      throw new Error("[tiktok] No se puede renovar el token sin App ID y Client Secret.");
    }

    const response = await fetch(apiUrl("/oauth2/refresh_token/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: serverEnv.tiktokClientKey,
        secret: serverEnv.tiktokClientSecret,
        refresh_token: bundle.refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    const json = (await response.json()) as TikTokApiResponse<TikTokTokenResponseData>;
    if (!response.ok || !json.data?.access_token) {
      throw new Error(json.message ?? "No se pudo renovar el acceso a TikTok.");
    }

    bundle = tokenBundleFromResponse(json.data, json, bundle);
    const { error: updateError } = await admin
      .from("integration_connections")
      .update({
        encrypted_credentials: {
          ciphertext: encryptJson(bundle),
          expires_at: bundle.expiresAt ?? null,
          refresh_expires_at: bundle.refreshExpiresAt ?? null,
        },
        scopes: bundle.scopes,
        metadata: {
          expires_at: bundle.expiresAt ?? null,
          refresh_expires_at: bundle.refreshExpiresAt ?? null,
          refreshed_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);
  }

  return {
    id: data.id,
    organizationId: data.organization_id,
    accessToken: bundle.accessToken,
    refreshToken: bundle.refreshToken,
    expiresAt: bundle.expiresAt,
    scopes: bundle.scopes.length > 0 ? bundle.scopes : data.scopes ?? [],
  };
}

export async function listTikTokAdvertiserAccounts(
  organizationId: string,
): Promise<TikTokAdvertiserAccount[]> {
  const connection = await getTikTokConnection(organizationId);
  if (!connection) return [];

  const url = new URL(apiUrl("/oauth2/advertiser/get/"));
  url.searchParams.set("app_id", serverEnv.tiktokClientKey);
  url.searchParams.set("secret", serverEnv.tiktokClientSecret);

  const response = await fetch(url, {
    headers: { "Access-Token": connection.accessToken },
    cache: "no-store",
  });

  const json = (await response.json()) as TikTokApiResponse<TikTokAdvertiserListData>;
  if (!response.ok || !json.data) {
    throw new Error(json.message ?? "No se pudo listar cuentas de TikTok.");
  }

  const list = json.data.list ?? [];
  return list.map((item) => ({
    advertiserId: String(item.advertiser_id ?? item.id ?? ""),
    name: String(item.advertiser_name ?? item.name ?? "Cuenta TikTok"),
    currency: item.currency ? String(item.currency) : null,
    timezone: item.timezone ? String(item.timezone) : null,
    status: item.status ? String(item.status) : null,
    raw: item,
  })).filter((item) => item.advertiserId);
}

export async function getTikTokDailySpend(input: {
  organizationId: string;
  advertiserId: string;
  startDate: string;
  endDate: string;
}): Promise<Array<{ date: string; amountCents: number; raw: Record<string, unknown> }>> {
  const connection = await getTikTokConnection(input.organizationId);
  if (!connection) throw new Error("La organización no tiene TikTok conectado.");

  const url = new URL(apiUrl("/report/integrated/get/"));
  url.searchParams.set("advertiser_id", input.advertiserId);
  url.searchParams.set("service_type", "AUCTION");
  url.searchParams.set("report_type", "BASIC");
  url.searchParams.set("data_level", "AUCTION_ADVERTISER");
  url.searchParams.set("dimensions", JSON.stringify(["advertiser_id", "stat_time_day"]));
  url.searchParams.set("metrics", JSON.stringify(["spend"]));
  url.searchParams.set("start_date", input.startDate);
  url.searchParams.set("end_date", input.endDate);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "1000");

  const response = await fetch(url, {
    headers: { "Access-Token": connection.accessToken },
    cache: "no-store",
  });
  const json = (await response.json()) as TikTokApiResponse<TikTokReportData>;
  if (!response.ok || json.code !== 0 || !json.data) {
    throw new Error(json.message ?? "No se pudo consultar el gasto de TikTok.");
  }

  return (json.data.list ?? []).flatMap((row) => {
    const rawDate = String(row.dimensions?.stat_time_day ?? "");
    const date = rawDate.slice(0, 10);
    const spend = Number(row.metrics?.spend ?? 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(spend) || spend < 0) {
      return [];
    }
    return [{
      date,
      amountCents: Math.round(spend * 100),
      raw: row as unknown as Record<string, unknown>,
    }];
  });
}

function nextUtcDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString();
}

function mapTikTokAdvertiserStatus(status?: string | null): "active" | "pending" | "disabled" {
  const normalized = (status ?? "").toUpperCase();
  if (
    !normalized ||
    normalized.includes("ENABLE") ||
    normalized.includes("ACTIVE") ||
    normalized === "STATUS_OK"
  ) {
    return "active";
  }
  if (
    normalized.includes("DISABLE") ||
    normalized.includes("CLOSE") ||
    normalized.includes("PUNISH") ||
    normalized.includes("BAN")
  ) {
    return "disabled";
  }
  return "pending";
}

export async function syncTikTokAdvertiserSpend(input: {
  organizationId: string;
  adAccountId: string;
  advertiserId: string;
  startDate: string;
  endDate: string;
}): Promise<TikTokSpendSyncResult> {
  const admin = createAdminClient();
  const dailySpend = await getTikTokDailySpend(input);
  const result: TikTokSpendSyncResult = {
    advertiserId: input.advertiserId,
    reportedDays: dailySpend.length,
    recordedDays: 0,
    recordedCents: 0,
    adjustments: [],
  };

  for (const day of dailySpend) {
    const { data: existing, error } = await admin
      .from("ad_spend_transactions")
      .select("amount_cents")
      .eq("organization_id", input.organizationId)
      .eq("ad_account_id", input.adAccountId)
      .eq("provider", "tiktok")
      .eq("metadata->>source", "tiktok_reporting")
      .gte("occurred_at", `${day.date}T00:00:00.000Z`)
      .lt("occurred_at", nextUtcDate(day.date));
    if (error) throw new Error(error.message);

    const alreadyRecordedCents = (existing ?? []).reduce(
      (total, item) => total + Number(item.amount_cents ?? 0),
      0,
    );
    const deltaCents = day.amountCents - alreadyRecordedCents;

    if (deltaCents < 0) {
      result.adjustments.push({
        date: day.date,
        reportedCents: day.amountCents,
        alreadyRecordedCents,
      });
      continue;
    }
    if (deltaCents === 0) continue;

    await recordProviderAdSpend({
      organizationId: input.organizationId,
      adAccountId: input.adAccountId,
      amountCents: deltaCents,
      occurredAt: `${day.date}T12:00:00.000Z`,
      externalSpendId: `tiktok:${input.advertiserId}:${day.date}:${day.amountCents}`,
      spendSource: "available",
      metadata: {
        source: "tiktok_reporting",
        advertiser_id: input.advertiserId,
        report_date: day.date,
        reported_total_cents: day.amountCents,
        previously_recorded_cents: alreadyRecordedCents,
        report: day.raw,
      },
    });
    result.recordedDays += 1;
    result.recordedCents += deltaCents;
  }

  return result;
}

export async function importTikTokAdvertiserAccounts(input: {
  organizationId: string;
  userId?: string | null;
}): Promise<{ imported: number }> {
  const admin = createAdminClient();
  const accounts = await listTikTokAdvertiserAccounts(input.organizationId);
  let imported = 0;

  for (const account of accounts) {
    const { error } = await admin.from("ad_accounts").upsert(
      {
        organization_id: input.organizationId,
        name: account.name,
        platform: "tiktok",
        external_account_id: account.advertiserId,
        external_account_name: account.name,
        status: mapTikTokAdvertiserStatus(account.status),
        currency: account.currency ?? "USD",
        timezone: account.timezone ?? "America/Lima",
        created_by: input.userId ?? null,
        last_synced_at: new Date().toISOString(),
        metadata: { tiktok: account.raw ?? {}, source: "tiktok_oauth" },
      },
      { onConflict: "organization_id,platform,external_account_id" },
    );
    if (!error) {
      const { data: stored } = await admin
        .from("ad_accounts")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("platform", "tiktok")
        .eq("external_account_id", account.advertiserId)
        .maybeSingle<{ id: string }>();

      if (stored?.id) {
        await ensureAdAccountLedgerAccounts(stored.id).catch(() => undefined);
      }
      imported += 1;
    }
  }

  return { imported };
}
