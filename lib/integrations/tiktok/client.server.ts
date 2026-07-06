import { createAdminClient } from "@/lib/supabase/admin";
import { encryptJson, decryptJson } from "@/lib/crypto/encryption.server";
import { serverEnv } from "@/lib/env/env.server";
import { ensureAdAccountLedgerAccounts } from "@/lib/ledger/ledger.server";
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

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeScopes(scope?: string | string[]): string[] {
  if (Array.isArray(scope)) return scope;
  if (!scope) return [];
  return scope.split(/[ ,]+/).map((item) => item.trim()).filter(Boolean);
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

  const now = Date.now();
  return {
    accessToken: json.data.access_token,
    refreshToken: json.data.refresh_token ?? null,
    expiresAt: json.data.expires_in
      ? new Date(now + json.data.expires_in * 1000).toISOString()
      : null,
    refreshExpiresAt: json.data.refresh_expires_in
      ? new Date(now + json.data.refresh_expires_in * 1000).toISOString()
      : null,
    scopes: normalizeScopes(json.data.scope),
    raw: json as unknown as Record<string, unknown>,
  };
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
  const bundle = decryptJson<TikTokTokenBundle>(data.encrypted_credentials.ciphertext);
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

  const response = await fetch(apiUrl("/oauth2/advertiser/get/"), {
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
        status: account.status === "STATUS_ENABLE" ? "active" : "pending",
        currency: account.currency ?? "USD",
        timezone: account.timezone ?? "America/Lima",
        created_by: input.userId ?? null,
        last_synced_at: new Date().toISOString(),
        metadata: { tiktok: account.raw ?? {} },
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
